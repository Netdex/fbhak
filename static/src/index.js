import 'whatwg-fetch'
import 'bootstrap'
import 'bootstrap-daterangepicker'
import google from 'google'

google.charts.load('current', { 'packages': ['timeline'] });
google.charts.setOnLoadCallback(init);

let data_container = $("#user-data");
data_container.hide();
let date_picker;

let user_container = $("#search-results");
let users = [];
let active_user = null;

let last_chart = null;
let chart_container = document.getElementById('activity-chart-container');

function display_user(i) {
    // show user in pane
    let user = users[i];
    active_user = user;
    update_activity(date_picker.startDate, date_picker.endDate);

    data_container.show();

    $("#data-img").attr('src', `https://graph.facebook.com/${user.userid}/picture?width=200`);
    let data = {
        ".data-name": user.name,
        ".data-nick": user.nick ? `(${user.nick})` : '',
        ".data-gender": user.gender,
    };
    for (let k in data) {
        $(k).html(data[k]);
    }
}

function display_results(users) {
    // show user search results and add callbacks
    user_container.empty();
    for (let u of users) {
        let element = $(`
            <div class="row">
                <div class="user-item">
                    <div class="user-img-holder">
                        <img src="https://graph.facebook.com/${u.userid}/picture?width=128" class="user-image" />
                    </div>
                    <div class="user-details">
                        <p class="user-name">${u.name}</p>
                        <p class="user-alias">${u.nick ? u.nick : "<br>"}</p>
                        <a href="${u.url}"><span class="label label-primary">View Profile</span></a>
                    </div>
                </div>
            </div>
            `);
        element.on('click', e => {
            display_user(u.id);
        });
        user_container.append(element);
    }
}

function activity_data_cb(user, data, start, end) {
    let chart = new google.visualization.Timeline(chart_container);
    if (last_chart) last_chart.clearChart();
    last_chart = chart;

    // map status id to name
    function status_name(id) {
        if (id == 0) return "✘";
        if (id == 2) return "✔";
        return "?";
    }

    let rows = [];
    let colors = [];
    const color_map = {
        "✔": "#66dd22",
        "✘": "#dd2222",
        "?": "#dddddd"
    }
    let last = { timestamp: start.toDate(), status: -999 };

    function add_row(name, status, start, end) {
        colors.push(color_map[status]);
        rows.push([name, status, start, end]);
    }

    for (let lat of data) {
        if (start == null) {
            start = lat;
        }
        else {
            if (lat.status != last.status) {
                let status = status_name(last.status);
                add_row(user.name, status, new Date(last.timestamp), new Date(lat.timestamp));
                last = lat;
            }
        }
    }
    if (last) {
        // make sure the end date is before now
        let final = new Date();
        if (end < final) final = end.toDate();
        add_row(user.name, status_name(last.status), new Date(last.timestamp), final);
    }
    
    if (rows.length > 0) {
        let dataTable = new google.visualization.DataTable();
        dataTable.addColumn({ type: 'string', id: 'User' });
        dataTable.addColumn({ type: 'string', id: 'Status' });
        dataTable.addColumn({ type: 'date', id: 'Start' });
        dataTable.addColumn({ type: 'date', id: 'End' });

        var options = {
            colors: colors
        };

        dataTable.addRows(rows);
        chart.draw(dataTable, options);
    }
}

function update_activity(start, end) {
    // fetch user activity and update chart
    if (active_user) {
        let activity = [];
        fetch(`/data/activity/${active_user.userid}/${start.unix() * 1000}/${end.unix() * 1000}`)
            .then(res => {
                return res.json();
            }).then(j => {
                activity = j;
                activity_data_cb(active_user, activity, start, end);
                $(".data-temp").html(JSON.stringify(activity));
            });
    }
}

function init_datepicker() {
    var start = moment().subtract(29, 'days');
    var end = moment();

    function cb(start, end) {
        $('#date-range span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
        update_activity(start, end);
    }

    $('#date-range').daterangepicker({
        startDate: start,
        endDate: end,
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            'Last 7 Days': [moment().subtract(6, 'days'), moment()],
            'Last 30 Days': [moment().subtract(29, 'days'), moment()],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, cb);
    date_picker = $("#date-range").data('daterangepicker');
    cb(start, end);
}

function init() {
    init_datepicker();

    // fetch user data and initialize search feature
    fetch('/data/users')
        .then(res => {
            return res.json();
        }).then(j => {
            users = j;
            for (let i = 0; i < users.length; i++) {
                users[i].id = i;
            }
            display_results(users);
        });

    $("#search-input").on('input', (e) => {
        let query = e.target.value;
        let results = users.filter((elem, index, arr) => elem.name.toLowerCase().includes(query.toLowerCase()));
        display_results(results);
    });
}
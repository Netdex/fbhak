delete from presence_data
    where exists (select 1
                  from presence_data a
                  where a.userid = presence_data.userid and
                        a.timestamp = presence_data.timestamp and
                        a.status = presence_data.status and
                        a.ctid > presence_data.ctid
                 );
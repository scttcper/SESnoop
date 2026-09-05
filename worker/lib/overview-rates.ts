import { sql } from 'drizzle-orm';

export type OverviewRateRow = {
  day_bucket: number;
  event_type: string;
  total: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
};

// Read anchors only in the selected range. Match outcomes by globally unique
// message_id so SQLite cannot choose the source-wide index for each lookup.
// The earlier-anchor check keeps duplicate notifications in their original day.
export const overviewRatesQuery = ({
  sourceId,
  start,
  end,
  now,
}: {
  sourceId: number;
  start: number;
  end: number;
  now: number;
}) => sql`
    with cohorts as (
      select message_id, lower(trim(recipient_email)) as recipient_email,
        event_type, min(event_at) as event_at
      from events
      where source_id = ${sourceId} and event_at >= ${start} and event_at <= ${end}
        and event_type in ('Send', 'Delivery')
      group by message_id, lower(trim(recipient_email)), event_type
    )
    select cast(cohorts.event_at / 86400000 as integer) as day_bucket,
      cohorts.event_type, count(*) as total,
      sum(case when cohorts.event_type = 'Delivery' then exists(select 1 from events outcome where outcome.message_id = cohorts.message_id
        and lower(trim(outcome.recipient_email)) = cohorts.recipient_email
        and outcome.event_type = 'Open' and outcome.event_at >= cohorts.event_at and outcome.event_at <= ${now}) else 0 end) as opened,
      sum(case when cohorts.event_type = 'Delivery' then exists(select 1 from events outcome where outcome.message_id = cohorts.message_id
        and lower(trim(outcome.recipient_email)) = cohorts.recipient_email
        and outcome.event_type = 'Click' and outcome.event_at >= cohorts.event_at and outcome.event_at <= ${now}) else 0 end) as clicked,
      sum(case when cohorts.event_type = 'Send' then exists(select 1 from events outcome where outcome.message_id = cohorts.message_id
        and lower(trim(outcome.recipient_email)) = cohorts.recipient_email
        and outcome.event_type = 'Bounce' and outcome.event_at >= cohorts.event_at and outcome.event_at <= ${now}) else 0 end) as bounced,
      sum(case when cohorts.event_type = 'Send' then exists(select 1 from events outcome where outcome.message_id = cohorts.message_id
        and lower(trim(outcome.recipient_email)) = cohorts.recipient_email
        and outcome.event_type = 'Complaint' and outcome.event_at >= cohorts.event_at and outcome.event_at <= ${now}) else 0 end) as complained
    from cohorts
    where not exists (
      select 1 from events earlier
      where earlier.message_id = cohorts.message_id and earlier.event_type = cohorts.event_type
        and lower(trim(earlier.recipient_email)) = cohorts.recipient_email
        and earlier.event_at < ${start}
    )
    group by day_bucket, cohorts.event_type
`;

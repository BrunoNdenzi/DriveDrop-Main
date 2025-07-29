-- Migration: 20250726_realtime_shipment_updates.sql
-- This migration adds triggers for handling real-time shipment updates

-- Enable real-time for shipments table
begin;

-- First, ensure the extension exists
create extension if not exists "pg_cron";

-- Cleanup old tracking events 
-- This helps keep the database size manageable by removing old tracking data
create or replace function cleanup_tracking_data()
returns void as $$
begin
  -- Delete tracking events older than 30 days
  delete from driver_locations
  where location_timestamp < (now() - interval '30 days');
  
  -- Delete tracking events for completed shipments
  delete from driver_locations dl
  where exists (
    select 1 from shipments s
    where s.id = dl.shipment_id
    and s.status in ('delivered', 'completed', 'cancelled')
    and s.updated_at < (now() - interval '7 days')
  );
end;
$$ language plpgsql security definer;

-- Schedule the cleanup to run daily at 3am
select cron.schedule(
  'cleanup-tracking-data',
  '0 3 * * *',
  $$select cleanup_tracking_data()$$
);

-- Trigger for shipment status updates
create or replace function handle_shipment_status_update()
returns trigger as $$
begin
  -- If status changed, create a tracking event
  if old.status is distinct from new.status then
    insert into tracking_events (
      shipment_id,
      event_type,
      notes,
      created_by
    )
    values (
      new.id,
      'status_change',
      'Status changed from ' || old.status || ' to ' || new.status,
      new.updated_by
    );
    
    -- If status changed to delivered, update the delivered_at timestamp
    if new.status = 'delivered' and old.status != 'delivered' then
      update shipments 
      set delivered_at = now() 
      where id = new.id;
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Drop the trigger if it exists
drop trigger if exists on_shipment_status_update on shipments;

-- Create the trigger
create trigger on_shipment_status_update
after update on shipments
for each row
when (old.status is distinct from new.status)
execute function handle_shipment_status_update();

-- Add proper RLS policies for real-time tracking

-- Driver location policies
create policy "Drivers can insert their own location"
on driver_locations for insert
to authenticated
with check (driver_id = auth.uid());

create policy "Drivers can select their own locations"
on driver_locations for select
to authenticated
using (driver_id = auth.uid());

create policy "Clients can view driver locations for their shipments"
on driver_locations for select
to authenticated
using (
  exists (
    select 1 from shipments s
    where s.id = driver_locations.shipment_id
    and s.client_id = auth.uid()
  )
);

commit;

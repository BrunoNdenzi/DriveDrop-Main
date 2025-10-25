-- Quick queries for monitoring job applications (drivers applying for shipments)

-- 1. Count applications by status
SELECT 
    status,
    COUNT(*) as count
FROM job_applications
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'pending' THEN 1
        WHEN 'accepted' THEN 2
        WHEN 'rejected' THEN 3
    END;

-- 2. View all pending applications with driver and shipment details
SELECT 
    ja.id,
    p.first_name || ' ' || p.last_name as driver_name,
    p.email,
    p.phone,
    s.title as shipment_title,
    s.pickup_address,
    s.delivery_address,
    s.estimated_price,
    s.status as shipment_status,
    ja.applied_at,
    EXTRACT(DAY FROM NOW() - ja.applied_at) as days_pending
FROM job_applications ja
JOIN profiles p ON ja.driver_id = p.id
JOIN shipments s ON ja.shipment_id = s.id
WHERE ja.status = 'pending'
ORDER BY ja.applied_at ASC;

-- 3. View applications by shipment (useful to see multiple drivers competing for same shipment)
SELECT 
    s.id as shipment_id,
    s.title,
    s.pickup_address,
    s.delivery_address,
    s.estimated_price,
    COUNT(ja.id) as total_applications,
    COUNT(CASE WHEN ja.status = 'pending' THEN 1 END) as pending_applications,
    COUNT(CASE WHEN ja.status = 'accepted' THEN 1 END) as accepted_applications
FROM shipments s
LEFT JOIN job_applications ja ON s.id = ja.shipment_id
WHERE s.status IN ('pending', 'accepted')
GROUP BY s.id, s.title, s.pickup_address, s.delivery_address, s.estimated_price
HAVING COUNT(ja.id) > 0
ORDER BY pending_applications DESC, s.created_at DESC;

-- 4. Application processing stats
SELECT 
    COUNT(*) as total_applications,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
    ROUND(AVG(EXTRACT(EPOCH FROM (responded_at - applied_at)) / 3600), 2) as avg_response_hours,
    COUNT(CASE WHEN status != 'pending' AND responded_at - applied_at < INTERVAL '1 hour' THEN 1 END) as responded_within_1h
FROM job_applications
WHERE status != 'pending';

-- 5. Recent activity (last 7 days)
SELECT 
    DATE(ja.applied_at) as date,
    COUNT(*) as new_applications,
    COUNT(CASE WHEN ja.status = 'accepted' AND ja.responded_at >= NOW() - INTERVAL '7 days' THEN 1 END) as accepted,
    COUNT(CASE WHEN ja.status = 'rejected' AND ja.responded_at >= NOW() - INTERVAL '7 days' THEN 1 END) as rejected
FROM job_applications ja
WHERE ja.applied_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(ja.applied_at)
ORDER BY date DESC;

-- 6. Verify shipment assignments after acceptance
SELECT 
    ja.id as application_id,
    ja.shipment_id,
    s.title as shipment_title,
    s.driver_id as assigned_driver,
    ja.driver_id as applicant_driver,
    p.first_name || ' ' || p.last_name as driver_name,
    s.status as shipment_status,
    ja.status as application_status,
    ja.responded_at as response_date,
    CASE 
        WHEN ja.status = 'accepted' AND s.driver_id != ja.driver_id THEN '⚠️ MISMATCH - Driver not assigned to shipment'
        WHEN ja.status = 'accepted' AND s.driver_id = ja.driver_id THEN '✅ Correct'
        ELSE 'N/A'
    END as assignment_check
FROM job_applications ja
JOIN shipments s ON ja.shipment_id = s.id
JOIN profiles p ON ja.driver_id = p.id
WHERE ja.status = 'accepted'
ORDER BY ja.responded_at DESC;

-- 7. Applications with missing or incomplete information
SELECT 
    ja.id,
    p.first_name || ' ' || p.last_name as driver_name,
    p.email,
    CASE 
        WHEN p.phone IS NULL OR p.phone = '' THEN '⚠️ Missing phone'
        ELSE '✅'
    END as phone_status,
    CASE 
        WHEN ja.notes IS NULL OR ja.notes = '' THEN '⚠️ No notes'
        ELSE '✅ Has notes'
    END as notes_status,
    s.title as shipment_title,
    ja.applied_at
FROM job_applications ja
JOIN profiles p ON ja.driver_id = p.id
JOIN shipments s ON ja.shipment_id = s.id
WHERE ja.status = 'pending'
    AND (
        p.phone IS NULL 
        OR p.phone = ''
    )
ORDER BY ja.applied_at ASC;

-- 8. Shipments with multiple pending applications (need admin decision)
SELECT 
    s.id as shipment_id,
    s.title,
    s.pickup_address,
    s.delivery_address,
    s.estimated_price,
    COUNT(ja.id) as pending_count,
    STRING_AGG(p.first_name || ' ' || p.last_name, ', ') as applicant_names
FROM shipments s
JOIN job_applications ja ON s.id = ja.shipment_id
JOIN profiles p ON ja.driver_id = p.id
WHERE ja.status = 'pending'
    AND s.status = 'pending'
GROUP BY s.id, s.title, s.pickup_address, s.delivery_address, s.estimated_price
HAVING COUNT(ja.id) > 1
ORDER BY pending_count DESC, s.created_at ASC;

-- 9. Monthly application trends
SELECT 
    TO_CHAR(applied_at, 'YYYY-MM') as month,
    COUNT(*) as total_applications,
    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
    ROUND(
        COUNT(CASE WHEN status = 'accepted' THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as acceptance_rate_percent
FROM job_applications
GROUP BY TO_CHAR(applied_at, 'YYYY-MM')
ORDER BY month DESC;

-- 10. Driver application success rate
SELECT 
    p.id as driver_id,
    p.first_name || ' ' || p.last_name as driver_name,
    p.email,
    COUNT(ja.id) as total_applications,
    COUNT(CASE WHEN ja.status = 'accepted' THEN 1 END) as accepted,
    COUNT(CASE WHEN ja.status = 'rejected' THEN 1 END) as rejected,
    COUNT(CASE WHEN ja.status = 'pending' THEN 1 END) as pending,
    ROUND(
        COUNT(CASE WHEN ja.status = 'accepted' THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(CASE WHEN ja.status != 'pending' THEN 1 END), 0) * 100, 
        2
    ) as success_rate_percent
FROM profiles p
JOIN job_applications ja ON p.id = ja.driver_id
WHERE p.role = 'driver'
GROUP BY p.id, p.first_name, p.last_name, p.email
HAVING COUNT(ja.id) > 0
ORDER BY success_rate_percent DESC NULLS LAST, total_applications DESC;


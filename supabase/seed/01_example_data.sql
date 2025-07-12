-- Example data for testing
-- Test users (passwords: Password123!)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@drivedrop.com', '$2a$10$r7M1ZhHB..TReXU7jRsUFOEXWBiZ3zOsYfb9QfV.pI68gP/PJ4SFq', NOW(), '{"first_name":"Admin","last_name":"User","role":"admin"}'),
    ('00000000-0000-0000-0000-000000000002', 'client1@example.com', '$2a$10$r7M1ZhHB..TReXU7jRsUFOEXWBiZ3zOsYfb9QfV.pI68gP/PJ4SFq', NOW(), '{"first_name":"John","last_name":"Doe","role":"client"}'),
    ('00000000-0000-0000-0000-000000000003', 'client2@example.com', '$2a$10$r7M1ZhHB..TReXU7jRsUFOEXWBiZ3zOsYfb9QfV.pI68gP/PJ4SFq', NOW(), '{"first_name":"Jane","last_name":"Smith","role":"client"}'),
    ('00000000-0000-0000-0000-000000000004', 'driver1@example.com', '$2a$10$r7M1ZhHB..TReXU7jRsUFOEXWBiZ3zOsYfb9QfV.pI68gP/PJ4SFq', NOW(), '{"first_name":"Mike","last_name":"Driver","role":"driver"}'),
    ('00000000-0000-0000-0000-000000000005', 'driver2@example.com', '$2a$10$r7M1ZhHB..TReXU7jRsUFOEXWBiZ3zOsYfb9QfV.pI68gP/PJ4SFq', NOW(), '{"first_name":"Sarah","last_name":"Johnson","role":"driver"}');

-- Manually set profile data
UPDATE profiles
SET 
    phone = CASE id
        WHEN '00000000-0000-0000-0000-000000000001' THEN '+15551234567'
        WHEN '00000000-0000-0000-0000-000000000002' THEN '+15552345678'
        WHEN '00000000-0000-0000-0000-000000000003' THEN '+15553456789'
        WHEN '00000000-0000-0000-0000-000000000004' THEN '+15554567890'
        WHEN '00000000-0000-0000-0000-000000000005' THEN '+15555678901'
    END,
    avatar_url = CASE id
        WHEN '00000000-0000-0000-0000-000000000001' THEN 'https://i.pravatar.cc/150?u=admin'
        WHEN '00000000-0000-0000-0000-000000000002' THEN 'https://i.pravatar.cc/150?u=client1'
        WHEN '00000000-0000-0000-0000-000000000003' THEN 'https://i.pravatar.cc/150?u=client2'
        WHEN '00000000-0000-0000-0000-000000000004' THEN 'https://i.pravatar.cc/150?u=driver1'
        WHEN '00000000-0000-0000-0000-000000000005' THEN 'https://i.pravatar.cc/150?u=driver2'
    END,
    is_verified = CASE id
        WHEN '00000000-0000-0000-0000-000000000001' THEN TRUE
        WHEN '00000000-0000-0000-0000-000000000004' THEN TRUE
        WHEN '00000000-0000-0000-0000-000000000005' THEN TRUE
        ELSE FALSE
    END,
    rating = CASE id
        WHEN '00000000-0000-0000-0000-000000000004' THEN 4.8
        WHEN '00000000-0000-0000-0000-000000000005' THEN 4.5
        ELSE NULL
    END
WHERE id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005'
);

-- Create driver applications
INSERT INTO driver_applications (
    id, user_id, status, vehicle_type, vehicle_make, vehicle_model, vehicle_year,
    license_number, license_expiry, insurance_provider, insurance_policy_number, insurance_expiry
)
VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'approved', 'car', 'Toyota', 'Camry', 2020, 'DL12345678', '2025-12-31', 'AllState', 'INS123456', '2024-12-31'),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'approved', 'van', 'Ford', 'Transit', 2021, 'DL87654321', '2026-06-30', 'Progressive', 'INS654321', '2024-06-30');

-- Create sample shipments
INSERT INTO shipments (
    id, client_id, driver_id, status, title, description,
    pickup_address, pickup_location, pickup_notes, pickup_time_window,
    delivery_address, delivery_location, delivery_notes, delivery_time_window,
    weight_kg, dimensions_cm, item_value, is_fragile,
    estimated_distance_km, estimated_price, final_price
)
VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000004',
        'in_transit',
        'Office Furniture Delivery',
        'Office chair and desk to be delivered',
        '123 Main St, New York, NY 10001',
        ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326)::GEOGRAPHY,
        'Front desk will have the items ready',
        TSTZRANGE(NOW() - INTERVAL '2 hour', NOW() - INTERVAL '1 hour'),
        '456 Park Ave, New York, NY 10022',
        ST_SetSRID(ST_MakePoint(-73.9654, 40.7638), 4326)::GEOGRAPHY,
        'Deliver to 5th floor, suite 505',
        TSTZRANGE(NOW(), NOW() + INTERVAL '1 hour'),
        35.5,
        '{"length": 120, "width": 80, "height": 90}',
        450.00,
        FALSE,
        5.2,
        75.00,
        75.00
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        NULL,
        'pending',
        'Electronics Package',
        'Fragile electronics equipment',
        '789 Broadway, New York, NY 10003',
        ST_SetSRID(ST_MakePoint(-73.9911, 40.7335), 4326)::GEOGRAPHY,
        'Package will be at the loading dock',
        TSTZRANGE(NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '2 hour'),
        '101 Lexington Ave, New York, NY 10016',
        ST_SetSRID(ST_MakePoint(-73.9819, 40.7430), 4326)::GEOGRAPHY,
        'Security desk will accept the delivery',
        TSTZRANGE(NOW() + INTERVAL '1 day' + INTERVAL '3 hour', NOW() + INTERVAL '1 day' + INTERVAL '5 hour'),
        12.8,
        '{"length": 50, "width": 40, "height": 30}',
        1200.00,
        TRUE,
        3.8,
        65.00,
        NULL
    );

-- Create tracking events for shipment 1
INSERT INTO tracking_events (
    shipment_id, event_type, created_by, location, notes
)
VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        'created',
        '00000000-0000-0000-0000-000000000002',
        ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326)::GEOGRAPHY,
        'Shipment created'
    ),
    (
        '00000000-0000-0000-0000-000000000001',
        'accepted',
        '00000000-0000-0000-0000-000000000004',
        ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326)::GEOGRAPHY,
        'Shipment accepted by driver'
    ),
    (
        '00000000-0000-0000-0000-000000000001',
        'pickup',
        '00000000-0000-0000-0000-000000000004',
        ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326)::GEOGRAPHY,
        'Items picked up from origin'
    );

-- Create tracking events for shipment 2
INSERT INTO tracking_events (
    shipment_id, event_type, created_by, location, notes
)
VALUES
    (
        '00000000-0000-0000-0000-000000000002',
        'created',
        '00000000-0000-0000-0000-000000000003',
        ST_SetSRID(ST_MakePoint(-73.9911, 40.7335), 4326)::GEOGRAPHY,
        'Shipment created'
    );

-- Create messages for shipment 1
INSERT INTO messages (
    shipment_id, sender_id, content, is_read
)
VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'Hi, any updates on the delivery time?',
        TRUE
    ),
    (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000004',
        'Yes, I should be there in about 20 minutes',
        TRUE
    ),
    (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'Great, thanks for the update!',
        FALSE
    );

-- Create payment for shipment 1
INSERT INTO payments (
    shipment_id, client_id, amount, status, payment_method, payment_intent_id
)
VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        75.00,
        'completed',
        'credit_card',
        'pi_1234567890'
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        65.00,
        'pending',
        NULL,
        'pi_0987654321'
    );

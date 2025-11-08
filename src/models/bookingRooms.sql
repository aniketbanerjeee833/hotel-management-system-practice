CREATE TABLE booking_rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id VARCHAR(20) NOT NULL,
    booking_room_id VARCHAR(20) UNIQUE NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    check_in DATE,
    check_out DATE,
    room_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
)
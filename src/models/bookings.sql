CREATE TABLE bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id VARCHAR(20) UNIQUE NOT NULL,
    customer_id VARCHAR(20) NOT NULL,
    hotel_id VARCHAR(20) NOT NULL,
    room_number VARCHAR(20) NOT NULL,
  
    total_amount DECIMAL(10,2),
    booking_status ENUM('Confirmed','Cancelled') DEFAULT 'Confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number)
);

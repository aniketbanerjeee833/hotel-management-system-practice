CREATE TABLE rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id VARCHAR(20) UNIQUE NOT NULL,
    hotel_id VARCHAR(20) NOT NULL,
    room_number VARCHAR(10),
    room_type enum('Deluxe', 'Suite', 'Standard') DEFAULT 'Standard' NOT NULL, -- Deluxe, Suite, Standard
    price_per_night DECIMAL(10,2),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id)
);
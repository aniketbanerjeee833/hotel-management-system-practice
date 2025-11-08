CREATE TABLE services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    service_id VARCHAR(20) UNIQUE NOT NULL,
    hotel_id VARCHAR(20) NOT NULL,
    service_name VARCHAR(100), -- Spa, Room Cleaning, Breakfast, etc.
    service_charge DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id)
);

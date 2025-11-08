CREATE TABLE reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    review_id VARCHAR(20) UNIQUE NOT NULL,
    hotel_id INT NOT NULL,
    customer_id INT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    review_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

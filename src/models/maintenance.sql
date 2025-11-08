CREATE TABLE maintenance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    maintenance_id VARCHAR(20) UNIQUE NOT NULL,
    room_id VARCHAR(20) NOT NULL,
    issue_description TEXT,
    maintenance_date DATE,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);

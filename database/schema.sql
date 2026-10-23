-- ==========================================================
-- Pharmacy Management System Database Schema
-- Database: pharmacy_db
-- Compatible with MySQL 5.7+ and MySQL 8.0+ / MySQL Workbench
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `pharmacy_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `pharmacy_db`;

-- ----------------------------------------------------------
-- Table structure for table `company`
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company` (
  `NAME` VARCHAR(50) NOT NULL,
  `ADDRESS` VARCHAR(100) NOT NULL,
  `PHONE` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- Table structure for table `users`
-- Note: PASSWORD length is 255 to support bcrypt password hashing
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `ID` INT(11) NOT NULL,
  `NAME` VARCHAR(50) NOT NULL UNIQUE,
  `DOB` VARCHAR(20) NOT NULL,
  `ADDRESS` VARCHAR(100) NOT NULL,
  `PHONE` VARCHAR(20) NOT NULL,
  `SALARY` DOUBLE NOT NULL,
  `PASSWORD` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- Table structure for table `drugs`
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `drugs` (
  `BARCODE` VARCHAR(50) NOT NULL,
  `NAME` VARCHAR(100) NOT NULL,
  `TYPE` VARCHAR(30) NOT NULL,
  `DOSE` VARCHAR(30) NOT NULL,
  `CODE` VARCHAR(30) NOT NULL,
  `COST_PRICE` DOUBLE NOT NULL,
  `SELLING_PRICE` DOUBLE NOT NULL,
  `EXPIRY` VARCHAR(30) NOT NULL DEFAULT 'Available for use',
  `COMPANY_NAME` VARCHAR(50) NOT NULL,
  `PRODUCTION_DATE` DATE NOT NULL,
  `EXPIRATION_DATE` DATE NOT NULL,
  `PLACE` VARCHAR(50) NOT NULL,
  `QUANTITY` INT(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`BARCODE`),
  CONSTRAINT `fk_drugs_company` FOREIGN KEY (`COMPANY_NAME`) 
    REFERENCES `company` (`NAME`) 
    ON UPDATE CASCADE 
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- Table structure for table `purchase`
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase` (
  `BARCODE` VARCHAR(50) NOT NULL,
  `NAME` VARCHAR(100) NOT NULL,
  `TYPE` VARCHAR(30) NOT NULL,
  `COMPANY_NAME` VARCHAR(50) NOT NULL,
  `QUANTITY` INT(11) NOT NULL,
  `PRICE` DOUBLE NOT NULL,
  `AMOUNT` DOUBLE NOT NULL,
  PRIMARY KEY (`BARCODE`),
  CONSTRAINT `fk_purchase_company` FOREIGN KEY (`COMPANY_NAME`) 
    REFERENCES `company` (`NAME`) 
    ON UPDATE CASCADE 
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- Table structure for table `sales` (Current active bill cart)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales` (
  `ID` INT(11) NOT NULL AUTO_INCREMENT,
  `BARCODE` VARCHAR(50) NOT NULL,
  `NAME` VARCHAR(100) NOT NULL,
  `TYPE` VARCHAR(30) NOT NULL,
  `DOSE` VARCHAR(30) NOT NULL,
  `QUANTITY` INT(11) NOT NULL,
  `PRICE` DOUBLE NOT NULL,
  `AMOUNT` DOUBLE NOT NULL,
  `DATE` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- Table structure for table `history_sales` (Historical sales log)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `history_sales` (
  `ID` INT(11) NOT NULL AUTO_INCREMENT,
  `USER_NAME` VARCHAR(50) NOT NULL,
  `BARCODE` VARCHAR(50) NOT NULL,
  `NAME` VARCHAR(100) NOT NULL,
  `TYPE` VARCHAR(30) NOT NULL,
  `DOSE` VARCHAR(30) NOT NULL,
  `QUANTITY` INT(11) NOT NULL,
  `PRICE` DOUBLE NOT NULL,
  `AMOUNT` DOUBLE NOT NULL,
  `DATE` VARCHAR(20) NOT NULL,
  `TIME` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- Table structure for table `login` (Login session audit log)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login` (
  `ID` INT(11) NOT NULL AUTO_INCREMENT,
  `NAME` VARCHAR(50) NOT NULL,
  `TYPE` VARCHAR(20) NOT NULL,
  `DATE` VARCHAR(20) NOT NULL,
  `TIME` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- Table structure for table `inbox` (User direct messages)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inbox` (
  `ID` INT(11) NOT NULL AUTO_INCREMENT,
  `MESSAGE_FROM` VARCHAR(50) NOT NULL,
  `MESSAGE_TO` VARCHAR(50) NOT NULL,
  `MESSAGE_TEXT` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------
-- Table structure for table `message_history`
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `message_history` (
  `ID` INT(11) NOT NULL AUTO_INCREMENT,
  `MESSAGE_FROM` VARCHAR(50) NOT NULL,
  `MESSAGE_TO` VARCHAR(50) NOT NULL,
  `MESSAGE_TEXT` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================================
-- Safe Initial Data Insertion (INSERT IGNORE preserves existing data)
-- ==========================================================

-- Companies
INSERT IGNORE INTO `company` (`NAME`, `ADDRESS`, `PHONE`) VALUES
('Cipla', 'Mumbai, India', '022-24826000'),
('Sun Pharma', 'Mysore, India', '01289078443'),
('Med_City', 'Nellore, India', '010114367832');

-- Users (Default Admin: ID 1, Password 'admin')
INSERT IGNORE INTO `users` (`ID`, `NAME`, `DOB`, `ADDRESS`, `PHONE`, `SALARY`, `PASSWORD`) VALUES
(1, 'admin', '23-12-1995', 'Mumbai, India', '9800000000', 50000, 'admin'),
(2, 'mark', '03-02-1988', 'Bangalore, India', '01290789432', 25000, 'mark123'),
(3, 'clark', '15-06-1990', 'New Delhi, India', '01147893423', 28000, 'clark123');

-- Purchases
INSERT IGNORE INTO `purchase` (`BARCODE`, `NAME`, `TYPE`, `COMPANY_NAME`, `QUANTITY`, `PRICE`, `AMOUNT`) VALUES
('fsdgjfihjorodsf', 'Novalo', 'Bills', 'Med_City', 40, 2.0, 80.0),
('ftrkl432432md', 'Novafol', 'Bills', 'Cipla', 30, 25.0, 750.0),
('8901234567890', 'Paracetamol', 'Bills', 'Sun Pharma', 100, 1.5, 150.0);

-- Drugs (Stock inventory)
INSERT IGNORE INTO `drugs` (`BARCODE`, `NAME`, `TYPE`, `DOSE`, `CODE`, `COST_PRICE`, `SELLING_PRICE`, `EXPIRY`, `COMPANY_NAME`, `PRODUCTION_DATE`, `EXPIRATION_DATE`, `PLACE`, `QUANTITY`) VALUES
('fsdgjfihjorodsf', 'Novalo', 'Bills', '500mg', '3d00', 2.0, 3.5, 'Available for use', 'Med_City', '2024-01-10', '2027-01-10', 'N-Right', 40),
('ftrkl432432md', 'Novafol', 'Bills', '250mg', '2xaa', 25.0, 35.0, 'Available for use', 'Cipla', '2023-05-15', '2026-12-15', 'N-Left', 27),
('8901234567890', 'Paracetamol', 'Bills', '650mg', '1p01', 1.5, 2.5, 'Available for use', 'Sun Pharma', '2024-03-01', '2027-03-01', 'A-Right', 100),
('9900112233445', 'Amoxicillin', 'Capsule', '500mg', '4m02', 12.0, 18.0, 'Available for use', 'Cipla', '2023-08-20', '2026-08-20', 'B-Left', 8);

-- Initial Login history
INSERT IGNORE INTO `login` (`ID`, `NAME`, `TYPE`, `DATE`, `TIME`) VALUES
(1, 'admin', 'Admin', '21-10-2026', '10:00:00');

-- Initial History Sales
INSERT IGNORE INTO `history_sales` (`ID`, `USER_NAME`, `BARCODE`, `NAME`, `TYPE`, `DOSE`, `QUANTITY`, `PRICE`, `AMOUNT`, `DATE`, `TIME`) VALUES
(1, 'admin', 'fsdgjfihjorodsf', 'Novalo', 'Bills', '500mg', 2, 3.5, 7.0, '21-10-2026', '10:05:00'),
(2, 'mark', '8901234567890', 'Paracetamol', 'Bills', '650mg', 5, 2.5, 12.5, '21-10-2026', '10:15:30');

-- Initial Inbox Message
INSERT IGNORE INTO `inbox` (`ID`, `MESSAGE_FROM`, `MESSAGE_TO`, `MESSAGE_TEXT`) VALUES
(1, 'admin', 'mark', 'Welcome to Pharmacy Management System! Please review the stock list.');

-- Kitchen-sink MySQL schema: every data type, constraint and relationship
-- shape Fixzy SysMaker's SQL import supports. Deliberately messy:
-- backticks, ENGINE clauses, reserved-ish names, self refs, composite keys.

CREATE TABLE `departments` (
  `dept_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `dept_code` VARCHAR(16) NOT NULL,
  `dept_name` VARCHAR(120) NOT NULL,
  `budget` DECIMAL(12,2) DEFAULT 0.00,
  `is_active` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`dept_id`),
  UNIQUE KEY `uq_dept_code` (`dept_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `locations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `campus` VARCHAR(80) NOT NULL,
  `building` VARCHAR(80) NOT NULL,
  `capacity` SMALLINT DEFAULT 0,
  `geo_lat` DOUBLE DEFAULT NULL,
  `opened_on` DATE DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_campus_building` (`campus`, `building`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `staff` (
  `staff_no` INT NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `rank` CHAR(3) DEFAULT 'LEC',
  `salary` DECIMAL(10,2) UNSIGNED DEFAULT 0.00,
  `bio` TEXT,
  `notes` LONGTEXT,
  `dept_id` INT UNSIGNED NOT NULL,
  `location_id` BIGINT UNSIGNED DEFAULT NULL,
  `supervisor_id` INT DEFAULT NULL,
  `joined_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`staff_no`),
  UNIQUE KEY `uq_staff_email` (`email`),
  KEY `idx_staff_dept` (`dept_id`),
  KEY `idx_staff_loc_join` (`location_id`, `joined_at`),
  CONSTRAINT `fk_staff_dept` FOREIGN KEY (`dept_id`) REFERENCES `departments` (`dept_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_staff_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_staff_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `staff` (`staff_no`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `courses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_code` VARCHAR(12) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `credits` TINYINT UNSIGNED DEFAULT 3,
  `level` SMALLINT DEFAULT 1,
  `tuition` FLOAT DEFAULT 0,
  `syllabus` MEDIUMTEXT,
  `dept_id` INT UNSIGNED NOT NULL,
  `coordinator_staff_no` INT DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_course_code` (`course_code`),
  UNIQUE KEY `uq_course_coordinator` (`coordinator_staff_no`),
  CONSTRAINT `fk_course_dept` FOREIGN KEY (`dept_id`) REFERENCES `departments` (`dept_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_course_coord` FOREIGN KEY (`coordinator_staff_no`) REFERENCES `staff` (`staff_no`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `students` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_no` VARCHAR(20) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `gpa` DECIMAL(3,2) DEFAULT 0.00,
  `enrolled_on` DATE NOT NULL,
  `photo_path` VARCHAR(255) DEFAULT NULL,
  `home_addr` TEXT,
  `dept_id` INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_no` (`student_no`),
  KEY `idx_student_name` (`full_name`),
  CONSTRAINT `fk_student_dept` FOREIGN KEY (`dept_id`) REFERENCES `departments` (`dept_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `enrollments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  `term` VARCHAR(12) NOT NULL,
  `grade` CHAR(2) DEFAULT NULL,
  `enrolled_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enroll` (`student_id`, `course_id`, `term`),
  KEY `idx_enroll_course` (`course_id`),
  CONSTRAINT `fk_enroll_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enroll_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `prerequisites` (
  `course_id` INT UNSIGNED NOT NULL,
  `prereq_course_id` INT UNSIGNED NOT NULL,
  `min_grade` CHAR(2) DEFAULT 'C',
  PRIMARY KEY (`course_id`, `prereq_course_id`),
  CONSTRAINT `fk_prereq_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_prereq_prereq` FOREIGN KEY (`prereq_course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `staff_profiles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `staff_no` INT NOT NULL,
  `office_hours` VARCHAR(120) DEFAULT NULL,
  `expertise` TEXT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_profile_staff` (`staff_no`),
  CONSTRAINT `fk_profile_staff` FOREIGN KEY (`staff_no`) REFERENCES `staff` (`staff_no`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `audit_log` (
  `log_id` BIGINT UNSIGNED ZEROFILL NOT NULL AUTO_INCREMENT,
  `actor_staff_no` INT DEFAULT NULL,
  `action` VARCHAR(60) NOT NULL,
  `payload` LONGTEXT,
  `acted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_audit_actor` (`actor_staff_no`),
  CONSTRAINT `fk_audit_staff` FOREIGN KEY (`actor_staff_no`) REFERENCES `staff` (`staff_no`) ON DELETE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `tags` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tag_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `course_tags` (
  `course_id` INT UNSIGNED NOT NULL,
  `tag_id` INT NOT NULL,
  PRIMARY KEY (`course_id`, `tag_id`),
  CONSTRAINT `fk_ct_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ct_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

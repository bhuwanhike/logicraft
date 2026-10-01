-- Give the seeded demo account a real bcrypt hash so the demo credentials shown
-- on the login page actually work against the API. The V7 placeholder
-- ('$2a$10$notarealhash...') is not a valid bcrypt digest, so
-- BCryptPasswordEncoder.matches() rejects every password for it.
--
-- Password: LogiCraft2026 (the value printed in the login form's demo box).
UPDATE users
   SET password_hash = '$2a$10$LgbbX/FKdM1BEVhypzuY2O2q4Cx0ZI36nQkqTqh947H8OQ6zGvrzS',
       updated_at    = now()
 WHERE email = 'demo@logicraft.io'
   AND password_hash = '$2a$10$notarealhashplaceholder0000000000000000000000000000000';

-- V3 filled these three from regexp_replace, leaving them upper-cased while the
-- rest of the role labels are title-cased. Align them with the signup role list.
UPDATE roles SET display_name = 'Dispatcher' WHERE name = 'ROLE_DISPATCHER' AND display_name = 'DISPATCHER';
UPDATE roles SET display_name = 'Driver'     WHERE name = 'ROLE_DRIVER'     AND display_name = 'DRIVER';
UPDATE roles SET display_name = 'Customer'   WHERE name = 'ROLE_CUSTOMER'   AND display_name = 'CUSTOMER';

-- The users.email unique constraint is case-sensitive, but signup treats an
-- address case-insensitively. Without this index two concurrent signups can
-- slip through the pre-flight check and both insert 'Ada@x.com' and 'ada@x.com'.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

const express = require('express');
const mysql = require('mysql');
const router = express.Router();
const dotenv = require('dotenv');
const userController = require('../controller/users');
dotenv.config({ path: './.env' });

const db = mysql.createConnection({
    host: process.env.db_host,
    user: process.env.db_user,
    password: process.env.db_password,
    database: process.env.db_name,
});

router.post('/login', userController.login);

router.get('/', (req, res) => {
    res.render('login');
});



router.get('/admin.hbs', (req, res) => {
    res.render('admin');
});

router.get('/admin', (req, res) => {
    res.render('admin');
});

router.get('/student_details_admin.hbs', (req, res) => {
    const guid = "1004";
    db.query("SELECT * FROM student_data WHERE guid = ?", [guid], (err, studentResult) => {
        if (err) {
            console.log(err);
            return res.send('Error retrieving student details');
        }

        // Render the Handlebars view with the retrieved student data
        res.render('student_details_admin', { studentData: studentResult });
    });
});

router.get(['/student', '/student.hbs'], (req, res) => {
    console.log(req.session.user_id)
    const user_id = req.session.user_id;

    // Query for student data
    db.query("SELECT * FROM student_data WHERE user_id = ?", [user_id], (err, studentResult) => {
        if (err) {
            console.log(err);
            return res.send('Error retrieving student data'); // Send error response if query fails
        }

        // Query for reviews data
        db.query("SELECT * FROM reviews", (err, reviewResult) => {
            if (err) {
                console.log(err);
                return res.send('Error retrieving reviews'); // Send error response if query fails
            }

            // Render the Handlebars view with both student data and reviews
            res.render('student', { studentData: studentResult, reviews: reviewResult });
        });
    });
});

router.get(['/faculty', '/faculty.hbs'], (req, res) => {
    const user_id = req.session.user_id;

    db.query('SELECT * FROM faculty WHERE user_id = ?', [user_id], (error, results) => {
        if (error) {
            console.error('Error fetching faculty details:', error);
            return res.status(500).send('Error retrieving faculty data.');
        }

        res.render('faculty', { facultyList: results });
    });
});

router.get('/sel_error.hbs', (req, res) => {
    res.render('sel_error');
});

router.get('/student_details.hbs', (req, res) => {
    // Retrieve the user_id from the session
    const user_id = req.session.user_id;

    // SQL query to get mentee details based on the faculty user_id
    const query = `
    SELECT 
        s.user_id, 
        s.name, 
        s.cgpa, 
        s.mentor,
        s.guid AS faculty_id,
        f.name AS faculty_name  -- Selecting faculty name
    FROM 
        student_data s 
    LEFT JOIN 
        faculty f ON s.guid = f.user_id
    WHERE 
        f.user_id = ?;  -- Filtering only by user_id
    `;

    // Execute the query with the dynamic user_id
    db.query(query, [user_id], (err, results) => {
        if (err) {
            // Handle any error that occurs during the query
            console.error('Error executing query:', err);
            return res.status(500).send('An error occurred while fetching mentee details.');
        }

        // Render the mentees_details.hbs view with the retrieved student data
        res.render('student_details', { student_data: results });
    });
});


router.get('/DSCS_students.hbs', (req, res) => {
    res.render('DSCS_students');
    
});




router.get('/review_schedules.hbs', (req, res) => {

    // Query to retrieve review data
    db.query("SELECT * FROM reviews", (err, reviewResult) => {
        if (err) {
            console.log(err);
            return res.send('Error retrieving reviews');
        }

        // Render the Handlebars view with both student data and reviews
        res.render('review_schedules', { reviews: reviewResult });
    });
});

router.get('/faculty-selection.hbs', async (req, res) => {
    const userId = req.session.user_id; // Get the user ID from the session

    // First, check the student_data table for the guid
    db.query('SELECT guid FROM student_data WHERE user_id = ?', [userId], (error, studentResults) => {
        if (error) {
            console.error('Error fetching student data:', error);
            return res.status(500).send('Error retrieving student data.');
        }

        // Check if guid is null
        if (studentResults.length > 0 && studentResults[0].guid !== null) {
            // If guid is not null, render sel_error.hbs
            return res.render('sel_error');
        }

        // If guid is null, proceed to fetch faculty data
        db.query(`
            SELECT * 
            FROM faculty 
            WHERE count_stu < 5 OR count_stu IS NULL
        `, (error, facultyResults) => {
            if (error) {
                console.error('Error fetching faculty details:', error);
                return res.status(500).send('Error retrieving faculty data.');
            }

            // Render the faculty selection page with the faculty data
            res.render('faculty-selection', { facultysel: facultyResults });
        });
    });
});




router.get('/list_facutly.hbs', (req, res) => {
    // Query to get the list of faculty members grouped by their domain
    db.query(`
        SELECT * 
        FROM faculty 
    `, (error, results) => {
        if (error) {
            console.error('Error fetching faculty details:', error);
            res.status(500).send('Error retrieving faculty data.');
        } else {
            res.render('list_facutly', { facultysel: results });
        }
    });
});


router.get('/mentees_details.hbs', (req, res) => {
    const userId = req.session.user_id; // Get the faculty user ID from the session

    // Ensure the user is logged in
    if (!userId) {
        return res.status(401).send('Unauthorized: No user ID in session.');
    }

    // Query to fetch the student details based on mentor_id
    const studentQuery = `
        SELECT * 
        FROM student_data 
        WHERE mentor_id = ?;
    `;

    db.query(studentQuery, [userId], (err, studentResult) => {
        if (err) {
            console.error('Error retrieving student details:', err);
            return res.status(500).send('Error retrieving student details.');
        }

        // Check if there are student details
        if (studentResult.length > 0) {
            // Render the Handlebars view with the retrieved student data
            res.render('mentees_details', { studentData: studentResult });
        } else {
            res.render('mentees_details', { message: 'No mentees assigned to this faculty yet.' });
        }
    });
});




router.post('/submit', (req, res) => {
    const facultyId = req.body.facultyId; // Get faculty ID from the request body
    const userId = req.session.user_id; // Get the user ID from the session

    // Debugging: Check the incoming IDs
    console.log('Received facultyId:', facultyId);
    console.log('Current userId from session:', userId);

    // Start the transaction
    db.beginTransaction((err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).send('Database Error');
        }

        // Update query to increment the count_stu
        const updateFacultyQuery = 'UPDATE faculty SET count_stu = count_stu + 1 WHERE user_id = ?';

        // Update the faculty count
        db.query(updateFacultyQuery, [facultyId], (err, result) => {
            if (err) {
                console.error('Error updating faculty count:', err);
                return db.rollback(() => {
                    res.status(500).send('Database Error');
                });
            }

            // Debugging: Check the result of the update
            console.log('Faculty count updated result:', result);

            // Update student_data to set guid to facultyId for the specified user_id
            const updateStudentDataQuery = 'UPDATE student_data SET guid = ? WHERE user_id = ?';

            // Update the student data
            db.query(updateStudentDataQuery, [facultyId, userId], (err, result) => {
                if (err) {
                    console.error('Error updating student data:', err);
                    return db.rollback(() => {
                        res.status(500).send('Database Error');
                    });
                }

                // Debugging: Check the result of the student data update
                console.log('Student data updated result:', result);

                // Commit the transaction
                db.commit((err) => {
                    if (err) {
                        console.error('Error committing transaction:', err);
                        return db.rollback(() => {
                            res.status(500).send('Database Error');
                        });
                    }

                    console.log('Student count successfully updated and student data modified:', result);
                    res.status(200).send('Student count and student data successfully updated');
                });
            });
        });
    });
});

router.get('/message.hbs', (req, res) => {
    // Query to fetch all messages
    db.query('SELECT * FROM messages ORDER BY id DESC;', (err, results) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Render the message template and pass the fetched messages
        res.render('message', { messages: results });
    });
});



router.post('/send-message', (req, res) => {
    const { message, receiver } = req.body; // Destructure message and receiver from the request body
    const sender = req.session.user_id; // Assuming you store the sender's user ID in the session

    // SQL query to insert the message, sender, and receiver
    const sql = 'INSERT INTO messages (message, sender, receiver) VALUES (?, ?, ?)';

    db.query(sql, [message, sender, receiver], (err, result) => {
        if (err) {
            console.error('Error inserting message:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.send('Message sent successfully!');
    });
});

router.delete('/delete-message/:id', (req, res) => {
    const messageId = req.params.id;

    db.query('DELETE FROM messages WHERE id = ?', [messageId], (err, result) => {
        if (err) {
            console.error('Error deleting message:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.send('Message deleted successfully.');
    });
});



router.get('/view-message.hbs', (req, res) => {
    const userId = req.session.user_id; // Assuming you store user ID in session
    const userRoleQuery = 'SELECT auth FROM user WHERE user_id = ?'; // Query to get user role

    // Check the user's role first
    db.query(userRoleQuery, [userId], (err, roleResults) => {
        if (err) {
            console.error('Error fetching user role:', err);
            return res.status(500).send('Error retrieving user role.');
        }

        // If no user role is found
        if (roleResults.length === 0) {
            return res.status(404).send('User not found.');
        }

        const userRole = roleResults[0].auth; // Get the user role (Student or Faculty)

        let messagesQuery;
        // Define the query based on user role
        if (userRole === 'Student') {
            messagesQuery = 'SELECT * FROM messages WHERE receiver IN ("Student", "All") ORDER BY id DESC'; // For students
        } else if (userRole === 'Faculty') {
            messagesQuery = 'SELECT * FROM messages WHERE receiver IN ("Faculty", "All") ORDER BY id DESC'; // For faculty
        } else if (userRole === 'admin') {
            messagesQuery = 'SELECT * FROM messages WHERE receiver IN ("Faculty", "All") ORDER BY id DESC'; // For faculty
        } else {
            return res.status(400).send('Invalid user role.');
        }

        // Execute the messages query
        db.query(messagesQuery, (err, results) => {
            if (err) {
                console.error('Error fetching messages:', err);
                return res.status(500).send('Error retrieving messages.');
            }

            // Format created_at dates before rendering
            const formattedMessages = results.map(message => {
                const date = new Date(message.created_at);
                message.formattedDate = `${date.toLocaleDateString('en-US')} ${date.toLocaleTimeString('en-US')}`;
                return message;
            });

            // Render the messages with formatted dates
            res.render('view-message', { messages: formattedMessages });
        });
    });
});


router.post('/api/students', (req, res) => {
    const { mentor_id, guid } = req.query;

    let query = 'SELECT * FROM student_data WHERE';
    let conditions = [];

    if (mentor_id) {
        conditions.push(`mentor_id = ?`);
    }
    if (guid) {
        conditions.push(`guid = ?`);
    }

    query += conditions.join(' OR '); // Use OR to fetch by either condition

    // Prepare the query parameters
    const params = [];
    if (mentor_id) {
        params.push(mentor_id);
    }
    if (guid) {
        params.push(guid);
    }

    db.query(query, params, (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Error fetching data' });
        }
        res.json(results);
    });
});

router.get('/review_sh_admin.hbs', (req, res) => {
    const query = 'SELECT * FROM reviews';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching reviews:', err.message);
            return res.status(500).send('Error retrieving reviews');
        }

        res.render('review_sh_admin', { reviews: results });
    });
});

// Route to delete a review
router.post('/delete-review', (req, res) => {
    const { review_name } = req.body;

    const query = 'DELETE FROM reviews WHERE review_name = ?';

    db.query(query, [review_name], (err, results) => {
        if (err) {
            console.error('Error deleting review:', err.message);
            return res.status(500).send('Error deleting review');
        }

        console.log('Review deleted successfully:', results);
        res.redirect('/review_sh_admin.hbs'); // Reload the admin page
    });
});




router.post('/add-review', (req, res) => {
    const { review_name, Date } = req.body;

    // SQL query to insert data
    const query = 'INSERT INTO reviews (review_name, Date) VALUES (?, ?)';

    db.query(query, [review_name, Date], (err, results) => {
        if (err) {
            console.error('Error inserting review:', err.message);
            return res.status(500).send('Error adding review');
        }
        console.log('Review added successfully:', results);
        res.redirect('/admin'); // Redirect to admin page after submission
    });
});

router.get('/faculty-review_schedules.hbs', (req, res) => {
    const query = 'SELECT * FROM reviews';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching reviews:', err.message);
            return res.status(500).send('Error retrieving reviews');
        }

        res.render('faculty-review_schedules', { reviews: results });
    });
});

module.exports = router;
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const {jwtAuthMiddleware, generateToken} = require('./../jwt');
const { sendMail } = require('./../mailer');
const crypto = require('crypto');


// POST route Signup_api
router.post('/signup', async (req, res) =>{
    try{
        const data = req.body     
        const adminUser = await User.findOne({ role: 'admin' });
        if (data.role === 'admin' && adminUser) {
            return res.status(400).json({ error: 'Admin user already exists' });
        }

        // Validate Aadhar Card Number must have exactly 12 digit
        if (!/^\d{12}$/.test(data.aadharCardNumber)) {
            return res.status(400).json({ error: 'Aadhar Card Number must be exactly 12 digits' });
        }

        // Check if a user with the same Aadhar Card Number already exists
        const existingUser = await User.findOne({ aadharCardNumber: data.aadharCardNumber });
        if (existingUser) {
            return res.status(400).json({ error: 'User with the same Aadhar Card Number already exists' });
        }

        const newUser = new User(data);

        // Save the new user to the database
        const response = await newUser.save();
        console.log('data saved');

        const payload = {
            id: response.id
        }
        console.log(JSON.stringify(payload));
        const token = generateToken(payload);

        res.status(200).json({response: response, token: token});
    }
    catch(err){
        console.log(err);
        res.status(500).json({error: 'Internal Server Error'});
    }
})

// Login Route
router.post('/login', async(req, res) => {
    try{
        const {aadharCardNumber, password} = req.body;

        // Check if aadharCardNumber or password is missing
        if (!aadharCardNumber || !password) {
            return res.status(400).json({ error: 'Aadhar Card Number and password are required' });
        }

        const user = await User.findOne({aadharCardNumber: aadharCardNumber});

        // If user does not exist or password does not match, return error
        if( !user || !(await user.comparePassword(password))){
            return res.status(401).json({error: 'Invalid Aadhar Card Number or Password'});
        }

        // generate Token 
        const payload = {
            id: user.id,
        }
        const token = generateToken(payload);

        res.json({token})
    }catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Profile route
router.get('/profile', jwtAuthMiddleware, async (req, res) => {
    try{
        const userData = req.user;
        const userId = userData.id;
        const user = await User.findById(userId);
        res.status(200).json({user});
    }catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.put('/profile/changePassword', jwtAuthMiddleware, async (req, res) => {
    try {
        const userId = req.user.id; 
        const { currentPassword, newPassword } = req.body; 

        // Check if currentPassword and newPassword are present in the request body
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Both currentPassword and newPassword are required' });
        }

        const user = await User.findById(userId);

        // If user does not exist or password does not match, return error
        if (!user || !(await user.comparePassword(currentPassword))) {
            return res.status(401).json({ error: 'Invalid current password' });
        }

        user.password = newPassword;
        await user.save();

        console.log('password updated');
        res.status(200).json({ message: 'Password updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


router.post('/profile/sendOtp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate an OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        console.log(`Generated OTP: ${otp}`);

        // Save OTP and expiration to user document
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;  // OTP expires in 10 minutes
        await user.save();
        console.log(`Saved OTP: ${otp} with expiration: ${user.otpExpires}`);

        // Define mail options
        const mailOptions = {
            to: user.email,
            from: process.env.GMAIL_USER,
            subject: 'Your OTP Code',
            text: `Your OTP code is ${otp}. It will expire in 10 minutes.`,
        };

        // Send mail
        await sendMail(mailOptions);

        res.status(200).json({ message: 'OTP sent to email' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/profile/resetPassword', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }

        const user = await User.findOne({ email });
        // console.log('Retrieved User:', user);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`Stored OTP: ${user.otp}, Provided OTP: ${otp}`);
        // console.log(`OTP Expiration Time: ${user.otpExpires}, Current Time: ${Date.now()}`);

        // Check if OTP is valid and not expired
        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Reset the password
        user.password = newPassword;
        user.otp = undefined; // Clear the OTP
        user.otpExpires = undefined; // Clear the OTP expiration
        await user.save();

        res.status(200).json({ message: 'Password reset successful' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
module.exports = router;
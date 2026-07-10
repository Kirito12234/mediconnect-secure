const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

/**
 * Google OAuth 2.0 strategy.
 *
 * This app is stateless (JWT httpOnly cookie), so passport sessions are not
 * used. The verify callback simply resolves/creates the User document and the
 * route handler issues the access-token cookie.
 *
 * Account linking: if a user with the same (Google-verified) email already
 * exists as a local account, we attach the googleId to it. Google emails are
 * verified by Google, so this is safe against email-spoofing account takeover.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) {
          return done(new Error('Google account has no email address'), null);
        }

        // 1. Already linked by googleId
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // 2. Link to an existing local account with the same email
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            user.isEmailVerified = true;
            await user.save();
          } else {
            // 3. Brand new account. A random, hashed password is stored so the
            //    account can never be accessed via password login.
            const randomPassword = await bcrypt.hash(
              crypto.randomBytes(32).toString('hex'),
              10
            );
            user = await User.create({
              name: profile.displayName,
              email,
              googleId: profile.id,
              password: randomPassword,
              isEmailVerified: true,
              role: 'user',
            });
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;

# Seed Data Reference

This project seeds local development data with `npm run db:seed`.

## What the seed script does

`db/seed.ts` resets and repopulates core demo data for the app:

- Users
- Academic structure
- Study programs
- Courses and enrollments
- Course weeks and weekly content
- Quizzes, questions, and answer options
- Flashcards
- Clubs, club members, and club chat messages
- Announcements

## Seeded demo accounts

All demo accounts use the password `password123`.

- Admin: `admin@optimolms.com`
- Professor 1: `malvinaniklekaj@optimolms.com`
- Professor 2: `jorabanda@optimolms.com`
- Student 1: `fjonadanglli@optimolms.com`
- Student 2: `vasjancupri@optimolms.com`

## Notable seeded course content

- `Advanced Machine Learning`
- `Web Application Engineering`
- `Data Visualization Studio`

The seed data includes weekly folders, quizzes, quiz questions, flashcards, and club activity so the dashboard has realistic content during development.

## Important note

The seeding script clears existing demo records before repopulating them, so it is best used only in local development.

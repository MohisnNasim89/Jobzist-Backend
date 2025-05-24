Jobzist Backend 🚀
Welcome to the Jobzist Backend! Jobzist is a robust and scalable backend system for a job portal application, designed to connect job seekers, employers, and companies. This project provides a RESTful API to manage user profiles, company profiles, job listings, resumes, applications, and more. Built with modern technologies like Node.js, Express, and MongoDB, Jobzist aims to streamline the job search and hiring process with features like AI-powered resume generation, ATS scoring, and secure file uploads via Cloudinary.

Table of Contents

-Project Overview
-Features
-Technologies Used
-Prerequisites
-Installation
-Configuration
-Running the Project
-API Endpoints
-Folder Structure
-Contributing
-Testing
-License
-Contact


Project Overview:
Jobzist Backend is the server-side component of the Jobzist job portal platform. It provides a RESTful API for managing users (job seekers, employers, company admins, and super admins), companies, job listings, and applications. The backend integrates with MongoDB for data storage, Cloudinary for file uploads (e.g., resumes and profile pictures), and includes AI-powered features like ATS scoring and cover letter generation. The system is designed to be secure, scalable, and efficient, with middleware for authentication, validation, and rate limiting.

Features:

User Management:

Create, update, and delete user profiles (job seekers, employers, company admins, super admins).
Role-based access control (RBAC) with permissions for different user types.
Connection suggestions for networking.


Company Management:

Create, update, and delete company profiles.
Manage company admins and their permissions.


Job Listings:

Create, update, delete, and toggle job listing status.
Public job search and company-specific job listings.
Apply to jobs and save jobs for later.


Resume Handling:

Upload, edit, and delete resumes.
AI-generated resumes based on user profiles.
Preview and download applicant resumes.


AI Features:

ATS score calculation and suggestions for job applications.
AI-generated cover letters for job applications (rate-limited).


System Administration:

Super admin dashboard to manage users, jobs, companies, and system reports.
Assign and remove admin roles (super admin, company admin).


Security:

JWT-based authentication with verifyToken middleware.
Rate limiting for AI endpoints to prevent abuse.
Input validation for all API routes.


File Uploads:

Secure file uploads for profile pictures, resumes, and media (images, videos) using Cloudinary.
Support for single and multiple file uploads.




Technologies Used

Node.js: JavaScript runtime for building the backend.
Express.js: Web framework for creating RESTful APIs.
MongoDB: NoSQL database for storing data (users, companies, jobs, etc.).
Mongoose: ODM for MongoDB to manage schemas and queries.
Cloudinary: Cloud storage for handling file uploads (resumes, profile pictures, media).
Multer: Middleware for handling multipart/form-data file uploads.
JWT (jsonwebtoken): For secure authentication.
Express Rate Limit: Rate limiting for AI endpoints.
Nodemon: For development server auto-restart.
dotenv: For managing environment variables.


Prerequisites
Before you begin, ensure you have the following installed:

Node.js: Version 18.x or higher (tested with v22.11.0).
MongoDB: A running MongoDB instance (local or cloud, e.g., MongoDB Atlas).
Cloudinary Account: For file uploads (profile pictures, resumes, media).
Git: For cloning the repository.


Installation

Clone the Repository:
git clone https://github.com/your-username/jobzist-backend.git
cd jobzist-backend


Install Dependencies:
npm install


Set Up Environment Variables:Create a .env file in the root directory and add the following variables:
PORT=5000
MONGO_URI=mongodb://localhost:27017/jobzist
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret


PORT: The port your server will run on.
MONGO_URI: Your MongoDB connection string.
JWT_SECRET: A secret key for JWT token generation.
CLOUDINARY_*: Credentials from your Cloudinary dashboard.




Configuration

MongoDB Setup:

Ensure MongoDB is running locally or use a cloud service like MongoDB Atlas.
Update the MONGO_URI in your .env file with your MongoDB connection string.


Cloudinary Setup:

Sign up for a Cloudinary account and get your credentials (cloud_name, api_key, api_secret).
Add these credentials to your .env file.


Rate Limiting:

The AI endpoints (/ats-score, /cover-letter) are rate-limited to 2 requests per minute per user. Adjust the windowMs and max values in src/middlewares/rateLimiter.js if needed.




Running the Project

Start the Development Server:
npm run dev

This uses nodemon to automatically restart the server on file changes.

Start the Production Server:
npm start


Access the API:The server will run on http://localhost:5000 (or the port specified in your .env file).



API Endpoints
Below is a summary of the main API endpoints. All endpoints are prefixed with /api.
Authentication

POST /auth/register: Register a new user.
POST /auth/login: Log in and receive a JWT token.

User Management

POST /user/:userId/profile: Create a user profile.
GET /user/:userId: Get the current user's profile.
PUT /user/:userId: Update the user's profile.
DELETE /user/:userId: Soft delete the user account.

Company Management

POST /company/create: Create a new company (company admin only).
GET /company/:companyId: Get a company profile.
PUT /company/:companyId: Update a company profile (company admin only).
DELETE /company/:companyId: Soft delete a company (company admin or super admin).

Job Management

POST /job/create: Create a new job listing (company admin or employer).
GET /job/:jobId: Get a job listing by ID.
GET /job/: Get all jobs (public).
PUT /job/:jobId: Update a job listing.
DELETE /job/:jobId: Soft delete a job listing.
POST /job/:jobId/apply: Apply for a job (job seeker only).
POST /job/:jobId/save: Save a job (job seeker only).
GET /job/:userId/saved: Get saved jobs for a user.
GET /job/:userId/applied: Get applied jobs for a user.

Resume Management

POST /upload/:userId/resume: Upload a resume (job seeker only).
POST /resume/:userId/generate: Generate an AI-powered resume.
PUT /resume/:userId: Edit a resume.
GET /resume/:userId: Get a user's resume.
DELETE /resume/:userId: Soft delete a resume.

Search

GET /search?query=term: Search for users and companies by name.
GET /connection/:userId/suggestions: Get connection suggestions for a user.

Super Admin

GET /admin/users: Get all users (super admin only).
DELETE /admin/users/:targetUserId: Delete a user (super admin only).
GET /admin/jobs: Get all jobs (super admin only).
DELETE /admin/jobs/:jobId: Delete a job (super admin only).
GET /admin/companies: Get all companies (super admin only).
DELETE /admin/companies/:companyId: Delete a company (super admin only).
GET /admin/reports: Get system reports (super admin only).
POST /admin/assign: Assign admin roles (super admin only).
DELETE /admin/remove/:targetUserId: Remove admin roles (super admin only).


Folder Structure
Jobzist-Backend/
├── src/
│   ├── config/                  # Configuration files
│   │   ├── cloudinaryConfig.js  # Cloudinary setup
│   │   ├── multerConfig.js      # Multer setup for file uploads
│   ├── controllers/             # Route handlers (controllers)
│   │   ├── job/                 # Job-related controllers
│   │   ├── uploadController.js  # File upload handlers
│   │   ├── userController.js    # User management handlers
│   │   ├── companyController.js # Company management handlers
│   │   ├── searchController.js  # Search and connection handlers
│   │   ├── superAdminController.js # Super admin handlers
│   ├── middlewares/             # Custom middleware
│   │   ├── authMiddleware.js    # JWT authentication
│   │   ├── rateLimiter.js       # Rate limiting for AI endpoints
│   ├── models/                  # Mongoose schemas
│   │   ├── user/                # User-related schemas
│   │   ├── company/             # Company schemas
│   │   ├── job/                 # Job schemas
│   │   ├── resume/              # Resume schemas
│   ├── routes/                  # API routes
│   │   ├── job/                 # Job-related routes
│   │   ├── uploadRoutes.js      # File upload routes
│   │   ├── userRoutes.js        # User routes
│   │   ├── companyRoutes.js     # Company routes
│   │   ├── searchRoutes.js      # Search routes
│   │   ├── superAdminRoutes.js  # Super admin routes
│   ├── services/                # External services (e.g., AI integration)
│   │   ├── aiService.js         # AI features (ATS score, cover letter)
│   ├── utils/                   # Utility functions
│   │   ├── logger.js            # Logging utility
│   │   ├── checks.js            # Reusable validation checks
│   ├── validations/             # Input validation
│   │   ├── jobValidation.js     # Job-related validations
│   │   ├── uploadValidation.js  # Upload validations
│   └── server.js                # Main server file
├── .env                         # Environment variables
├── package.json                 # Project dependencies and scripts
└── README.md                    # Project documentation


Contributing
We welcome contributions to Jobzist! Follow these steps to contribute:

Fork the Repository:
git clone https://github.com/your-username/jobzist-backend.git


Create a Feature Branch:
git checkout -b feature/your-feature-name


Commit Your Changes:
git commit -m "Add your feature description"


Push to Your Fork:
git push origin feature/your-feature-name


Open a Pull Request:

Go to the original repository on GitHub and open a pull request.
Provide a detailed description of your changes.



Code Style

Follow JavaScript best practices.
Use ESLint for linting (if configured).
Write clear, concise commit messages.


Testing
To test the API endpoints, you can use tools like Postman or cURL. Below are some example requests:

Create a Job:
curl -X POST http://localhost:5000/api/job/create \
-H "Authorization: Bearer your_jwt_token" \
-H "Content-Type: application/json" \
-d '{"title": "Software Engineer", "companyId": "company_id", "location": "Remote", "jobType": "Full-Time"}'


Apply for a Job:
curl -X POST http://localhost:5000/api/job/job_id/apply \
-H "Authorization: Bearer your_jwt_token"



Unit Testing
Unit tests are not yet implemented. Contributions to add testing with frameworks like Jest or Mocha are welcome!

License
This project is licensed under the MIT License. See the LICENSE file for details.

Contact
For questions or support, reach out to the project maintainers:

Email: your-email@example.com
GitHub: your-username


Happy Coding! 🎉

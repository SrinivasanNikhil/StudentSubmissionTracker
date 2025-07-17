# Student Submission Tracker

A comprehensive web application designed to help university students track and manage their course submissions, with advanced features for both students and administrators. The application supports SQL practice questions and ER diagram submissions with AI-powered evaluation capabilities.

## Features

### Student Features

- **User Authentication**: Secure login and registration system with role-based access (student/admin)
- **SQL Practice**: Interactive SQL question practice with real-time query execution
- **ER Diagram Submissions**: Upload and submit ER diagrams for data modeling questions
- **Progress Tracking**: Monitor completion status across all topics and question types
- **Student Dashboard**: View submitted diagrams and instructor feedback
- **Profile Management**: Update personal information and track individual progress

### Administrator Features

- **Comprehensive Admin Dashboard**: Complete administrative control panel
- **User Management**: View and manage all student accounts
- **ER Diagram Review**: Review submitted ER diagrams with AI evaluation assistance
- **AI-Powered Evaluation**: Automated ER diagram analysis using OpenAI GPT-4 Vision
- **Manual Review Tools**: Copy AI evaluations to admin review fields for human oversight
- **Submission Analytics**: Track submission patterns and completion rates

### Advanced Features

- **AI Integration**: OpenAI GPT-4 Vision API for automated ER diagram evaluation
- **File Upload System**: Secure PNG file upload for ER diagrams with validation
- **Real-time SQL Execution**: Execute SQL queries against multiple databases
- **Responsive Design**: Mobile-friendly interface using Bootstrap 5
- **Session Management**: Secure session handling with SQLite storage

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (with MySQL support)
- **Frontend**: EJS templates, Bootstrap 5, JavaScript
- **Authentication**: Session-based with bcrypt password hashing
- **File Upload**: Multer for secure file handling
- **AI Integration**: OpenAI API for ER diagram evaluation
- **ORM**: Sequelize for database operations

## Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd StudentSubmissionTracker
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:

   ```
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET=your_session_secret_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Initialize the database**:

   ```bash
   npm run init-db
   ```

5. **Start the application**:

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

6. **Access the application**:
   Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
StudentSubmissionTracker/
├── src/
│   ├── config/              # Database and application configuration
│   ├── controllers/         # Business logic controllers
│   ├── middleware/          # Authentication and session middleware
│   ├── migrations/          # Database migration files
│   ├── models/              # Sequelize models
│   ├── public/              # Uploaded files (ER diagrams)
│   ├── reference_files/     # Reference data for questions
│   ├── routes/              # Express routes
│   ├── scripts/             # Utility scripts
│   ├── services/            # External service integrations
│   ├── utils/               # Helper functions
│   ├── views/               # EJS templates
│   │   ├── pages/          # Main page templates
│   │   │   └── admin/      # Admin-specific templates
│   │   ├── layouts/        # Layout templates
│   │   └── partials/       # Reusable template components
│   ├── app.js              # Main application setup
│   └── server.js           # Server entry point
├── public/                  # Static assets (CSS, JS, images)
├── database.sqlite         # SQLite database file
└── package.json            # Project dependencies and scripts
```

## Key Features Breakdown

### SQL Practice System

- **Interactive Query Execution**: Students can write and execute SQL queries
- **Multiple Databases**: Support for different database contexts
- **Real-time Feedback**: Immediate query results and error handling
- **Progress Tracking**: Automatic completion tracking for correct solutions

### ER Diagram Submission System

- **File Upload**: Secure PNG file upload with validation
- **Student Enhancements**: Students explain modifications to base scenarios
- **AI Tool Reflection**: Students reflect on AI tool usage in their work
- **Student View**: Dedicated page for students to view their submissions

### AI Evaluation System

- **Automated Analysis**: OpenAI GPT-4 Vision analyzes ER diagrams
- **Context-Aware Evaluation**: AI considers specific question requirements
- **Scoring System**: 0-10 scoring with detailed feedback
- **Admin Integration**: AI results can be copied to admin review fields

### Admin Review System

- **Manual Evaluation**: Admins can provide human oversight
- **AI Assistance**: Copy AI evaluations to streamline review process
- **Comprehensive Dashboard**: View all submissions with filtering options
- **User Management**: Complete user account administration

## Database Models

- **User**: Manages user accounts, authentication, and role-based access
- **Topic**: Organizes learning topics (SQL, Data Modeling)
- **Question**: Stores questions with solutions and expected outputs
- **Completion**: Tracks user progress and submissions
- **Session**: Manages user sessions for authentication

## API Endpoints

### Authentication

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/logout` - User logout

### Questions & Topics

- `GET /topics` - List all topics
- `GET /questions/topic/:id` - Questions by topic
- `POST /questions/:id/execute` - Execute SQL queries
- `GET /questions/:id` - Question details

### ER Diagram Submissions

- `GET /er-diagrams/submit/:questionId` - Submission form
- `POST /er-diagrams/submit/:questionId` - Submit ER diagram
- `GET /er-diagrams/my-submission/:questionId` - Student view
- `POST /er-diagrams/admin/submissions/:id/evaluate` - AI evaluation

### Admin Routes

- `GET /admin` - Admin dashboard
- `GET /admin/users` - User management
- `GET /admin/submissions` - ER diagram submissions
- `POST /admin/submissions/:id` - Update admin review

## Dependencies

### Core Dependencies

- **express**: Web framework
- **sequelize**: ORM for database operations
- **ejs**: Templating language
- **bcrypt**: Password hashing
- **express-session**: Session management
- **sqlite3**: SQLite database driver

### File Upload & AI

- **multer**: File upload handling
- **openai**: OpenAI API integration

### Development

- **nodemon**: Auto-reload for development
- **jest**: Testing framework
- **supertest**: API testing

## Usage Examples

### For Students

1. Register/login to the system
2. Browse topics and select questions
3. For SQL questions: Write and execute queries
4. For ER diagrams: Upload PNG files with explanations
5. View progress and instructor feedback

### For Administrators

1. Access admin dashboard
2. Review ER diagram submissions
3. Use AI evaluation for automated analysis
4. Provide manual feedback and scores
5. Manage user accounts and system data

## Development

### Running Tests

```bash
npm test
```

### Database Operations

```bash
npm run create-db    # Create database
npm run init-db      # Initialize with sample data
```

### Environment Setup

Ensure all required environment variables are set in `.env`:

- `PORT`: Application port (default: 3000)
- `SESSION_SECRET`: Session encryption key
- `OPENAI_API_KEY`: OpenAI API key for AI evaluation
- `NODE_ENV`: Environment mode (development/production)

## License

This project is licensed under the ISC License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please create an issue in the repository.

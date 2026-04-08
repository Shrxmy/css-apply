<div align="center">

# CSSApply - Computer Science Society Recruitment Portal for R101

![CSSApply Logo](https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/logos/Logo_CSS%20Apply.svg)

**The official recruitment portal for the Computer Science Society at the University of Santo Tomas**

[![Next.js](https://img.shields.io/badge/Next.js-15.4.6-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.1.12-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.16.1-2D3748?style=for-the-badge&logo=prisma)](https://prisma.io/)

</div>

---

## About CSSApply

CSSApply is a comprehensive recruitment management system designed specifically for the **Computer Science Society (CSS)** at the University of Santo Tomas. This modern web application streamlines the entire recruitment process, from application submission to interview scheduling and candidate management.

### Key Features

- **Multi-Position Applications**: Support for Members, Committee Staff, and Executive Assistant positions
- **Smart Interview Scheduling**: Automated conflict detection and prevention
- **Admin Dashboard**: Comprehensive management tools for recruitment staff
- **Email Notifications**: Automated communication system using Brevo
- **Personality Assessment**: Integrated personality test for candidate evaluation
- **Secure Authentication**: NextAuth.js integration with role-based access control
- **Responsive Design**: Mobile-first approach with modern UI/UX

---

## Quick Start

### Prerequisites

- **Node.js** 18.0 or later
- **npm**, **yarn**, **pnpm**, or **bun**
- **PostgreSQL** database
- **Supabase** account (for file storage)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/css-apply.git
   cd css-apply
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Environment Setup**

   ```bash
   cp .env.example .env.local
   ```

   Configure the following environment variables:

   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/css_apply"

   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key"

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

   # Email (Brevo)
   BREVO_API_KEY="your-brevo-api-key"
   ```

4. **Database Setup**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start Development Server**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

---

## Project Structure

```
css-apply/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/              # Admin dashboard pages
│   │   ├── api/                # API routes
│   │   ├── auth/               # Authentication pages
│   │   ├── user/               # User application pages
│   │   └── personality-test/   # Personality assessment
│   ├── components/             # Reusable React components
│   ├── data/                   # Static data and configurations
│   ├── lib/                    # Utility functions and configurations
│   ├── styles/                 # Global styles and animations
│   └── types/                  # TypeScript type definitions
├── prisma/                     # Database schema and migrations
├── public/                     # Static assets
└── Configuration files
```

---

## Available Scripts

| Command         | Description                             |
| --------------- | --------------------------------------- |
| `npm run dev`   | Start development server with Turbopack |
| `npm run build` | Build the application for production    |
| `npm run start` | Start the production server             |
| `npm run lint`  | Run ESLint for code quality             |

---

## Application Types

### Member Application

- Basic membership application
- Simple form with personal information
- Automatic approval process

### Committee Staff Application

- Apply for specific committee positions
- Portfolio submission required
- Interview scheduling with committee heads

### Executive Assistant Application

- Apply to assist Executive Board members
- CV submission required
- Interview scheduling with EB members

---

## Security Features

- **Authentication**: NextAuth.js with multiple providers
- **Role-Based Access**: Admin, Super Admin, and User roles
- **CSRF Protection**: Built-in Next.js security
- **Environment Variables**: Secure configuration management
- **Input Validation**: Zod schema validation
- **Race Condition Prevention**: Atomic database operations

---

## Email System

CSSApply uses **Brevo** (formerly Sendinblue) for email communications:

- **Welcome Emails**: New user registration
- **Application Confirmations**: Successful submissions
- **Interview Notifications**: Schedule confirmations
- **Admin Alerts**: System notifications

### Email Templates

- Responsive HTML templates
- Brand-consistent styling
- Multi-language support ready

---

## Database Schema

### Core Models

- **User**: User accounts and profiles
- **EAApplication**: Executive Assistant applications
- **CommitteeApplication**: Committee Staff applications
- **EBProfile**: Executive Board member profiles
- **AvailableEBInterviewTime**: Interview slot management

### Key Features

- **Prisma ORM**: Type-safe database operations
- **Migrations**: Version-controlled schema changes
- **Relationships**: Proper foreign key constraints
- **Indexing**: Optimized query performance

---

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main branch

### Manual Deployment

1. Build the application: `npm run build`
2. Start the production server: `npm run start`
3. Configure reverse proxy (nginx/Apache)
4. Set up SSL certificates

### Environment Variables for Production

```env
NEXTAUTH_URL="https://your-domain.com"
DATABASE_URL="your-production-database-url"
NEXTAUTH_SECRET="your-production-secret"
```

---

## Contributing

We welcome contributions to CSSApply! Here's how you can help:

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Follow the configured rules
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Standardized commit messages

---

## Support

### Getting Help

- **Email**: <css.cics@ust.edu.ph>
- **Facebook**: [CSS Facebook Page](https://facebook.com/USTCSS)

---

<div align="center">

**Passionately designed & developed by CSS 👩‍💻👩‍💻**

[![CSS Logo](https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/logos/Logo_CSS.svg)](https://css.ust.edu.ph)

</div>

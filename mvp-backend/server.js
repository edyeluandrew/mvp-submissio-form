const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting - prevent spam
const submitLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many submissions, please try again later.'
  }
});

// Configure email transporter (using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false 
  }
});


transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server is ready');
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

app.post('/submit-mvp', submitLimit, async (req, res) => {
  try {
    const {
      teamName,
      teamEmail,
      projectTitle,
      projectBackground,
      problemStatement,
      unsdgGoals,
      teamMembers,
      youtubeLink,
      githubRepo
    } = req.body;

    const requiredFields = {
      teamName: 'Team Name',
      teamEmail: 'Team Email Address',
      projectTitle: 'Project Title', 
      projectBackground: 'Project Background',
      problemStatement: 'Problem Statement',
      youtubeLink: 'YouTube Link',
      githubRepo: 'GitHub Repository'
    };

    const errors = [];
    
    for (const [field, displayName] of Object.entries(requiredFields)) {
      if (!req.body[field] || req.body[field].trim() === '') {
        errors.push(displayName);
      }
    }

    if (teamEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(teamEmail.trim())) {
        errors.push('Team Email Address (must be a valid email format)');
      }
    }

    if (!unsdgGoals || !Array.isArray(unsdgGoals) || unsdgGoals.length === 0) {
      errors.push('UN Sustainable Development Goals (select at least one)');
    }

    if (!teamMembers || !Array.isArray(teamMembers) || teamMembers.filter(m => m.trim()).length === 0) {
      errors.push('Team Members (at least one member required)');
    }

    if (youtubeLink && !youtubeLink.includes('youtube.com') && !youtubeLink.includes('youtu.be')) {
      errors.push('YouTube Link (must be a valid YouTube URL)');
    }

    if (githubRepo && !githubRepo.includes('github.com')) {
      errors.push('GitHub Repository (must be a valid GitHub URL)');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const submissionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const submissionDate = new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Kampala',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const formattedMembers = teamMembers
      .filter(member => member.trim())
      .map((member, index) => `${index + 1}. ${member.trim()}`)
      .join('\n');

    const formattedSDGs = unsdgGoals
      .map((sdg, index) => `${index + 1}. ${sdg}`)
      .join('\n');

    const adminEmailBody = `
FUTURE TECH HACKATHON - MVP SUBMISSION
Organized by FOCLIS - Faculty of Computing and Library Information Science
Kabale University

═══════════════════════════════════════

📋 SUBMISSION DETAILS:
Submission ID: ${submissionId}
Submitted: ${submissionDate} (EAT)

👥 TEAM INFORMATION:
Team Name: ${teamName}
Team Email: ${teamEmail}
Project Title: ${projectTitle}

📖 PROJECT BACKGROUND:
${projectBackground}

❗ PROBLEM STATEMENT:
${problemStatement}

🎯 UN SUSTAINABLE DEVELOPMENT GOALS:
${formattedSDGs}

👨‍💻 TEAM MEMBERS:
${formattedMembers}

🔗 PROJECT LINKS:
🎥 YouTube Demo: ${youtubeLink}
💻 GitHub Repository: ${githubRepo}

═══════════════════════════════════════

📧 Reply to team at: ${teamEmail}
📞 This submission was automatically processed by the MVP Submission System.

FOCLIS - Faculty of Computing and Library Information Science
Kabale University
Contact: cosaku10@gmail.com
    `.trim();

    const participantEmailBody = `
Dear ${teamName} Team,

✅ Your MVP submission has been successfully received!

═══════════════════════════════════════

📋 SUBMISSION CONFIRMATION:
Project: ${projectTitle}
Submission ID: ${submissionId}
Submitted: ${submissionDate} (EAT)

Your submission includes:
✓ Project background and problem statement
✓ ${unsdgGoals.length} UN SDG goal(s) selected
✓ ${teamMembers.filter(m => m.trim()).length} team member(s)
✓ YouTube demonstration video
✓ GitHub repository link

═══════════════════════════════════════

📞 WHAT'S NEXT?
Our evaluation committee will review your submission. You'll be contacted within 5-7 business days with updates about your project status.

📧 NEED HELP?
For any questions or concerns, please contact us at:
cosaku10@gmail.com

Thank you for participating in the Future Tech Hackathon!

Best regards,
FOCLIS - Faculty of Computing and Library Information Science
Kabale University

═══════════════════════════════════════
This is an automated confirmation. Please do not reply to this email.
    `.trim();

    const emailPromises = [];

    // Email to admin
    emailPromises.push(
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'cosaku10@gmail.com',
        replyTo: teamEmail,
        subject: `🚀 MVP Submission - ${teamName} - ${projectTitle}`,
        text: adminEmailBody,
        html: adminEmailBody.replace(/\n/g, '<br>')
      })
    );

    emailPromises.push(
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: teamEmail,
        cc: 'cosaku10@gmail.com',
        subject: `✅ MVP Submission Confirmed - ${projectTitle}`,
        text: participantEmailBody,
        html: participantEmailBody.replace(/\n/g, '<br>')
      })
    );

    await Promise.all(emailPromises);

    console.log(`✅ MVP Submission received: ${teamName} - ${projectTitle} (ID: ${submissionId})`);

    res.json({
      success: true,
      message: 'MVP submission received successfully!',
      submissionId,
      submissionDate,
      teamName,
      projectTitle
    });

  } catch (error) {
    console.error('❌ Submission error:', error);
    
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your submission. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MVP Submission Server running on port ${PORT}`);
  console.log(`📧 Admin email: cosaku10@gmail.com`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
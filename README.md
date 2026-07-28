# Scientific Archive Bot

# MASTER PROMPT – AI SCIENTIFIC TELEGRAM PLATFORM



I want you to build a complete, production-ready, enterprise-grade Telegram Bot platform for managing scientific Telegram channels.



This is NOT a simple Telegram Bot.



It is a complete scientific content management platform that will archive, organize, classify, search, analyze and manage educational content from Telegram channels.



====================================================

GENERAL REQUIREMENTS

====================================================



Build the project using Clean Architecture.



Use modular architecture.



Separate all business logic from Telegram handlers.



The project must be scalable and maintainable.



Use dependency injection where appropriate.



Never hardcode configuration.



Everything must come from environment variables.



====================================================

TECHNOLOGY

====================================================



Use:



• Telegram Bot API



• PostgreSQL ONLY



• External PostgreSQL database



• DATABASE_URL environment variable



• Repository Pattern



• Service Layer



• Migration System



• Docker Ready



• GitHub Ready



• Render Ready



• Oracle Cloud Ready



====================================================

DATABASE

====================================================



DO NOT use Lovable built-in database.



Use ONLY external PostgreSQL.



Compatible with:



• Neon PostgreSQL



• Supabase PostgreSQL



Generate:



• SQL Schema



• Migrations



• Repository Layer



• Models



• Relationships



• Indexes



====================================================

ENVIRONMENT VARIABLES

====================================================



Use:



BOT_TOKEN



DATABASE_URL



OWNER_ID



ARCHIVE_CHANNEL_ID



LOG_LEVEL



====================================================

SYSTEM MODULES

====================================================



Design the project as independent modules.



Module 1



Telegram Core



Module 2



Channel Management



Module 3



Administrator Management



Module 4



Permission System



Module 5



Scientific File Management



Module 6



Archive System



Module 7



Search Engine



Module 8



Scientific Indexing



Module 9



Hashtag Management



Module 10



Statistics



Module 11



Reports



Module 12



Settings



Module 13



Activity Logs



====================================================

OWNER

====================================================



Owner has complete access.



Owner permissions can never be removed.



Owner ID comes from OWNER_ID.



====================================================

ADMINS

====================================================



Support unlimited administrators.



Every administrator can manage only assigned channels.



Use Role Based Access Control (RBAC).



====================================================

CHANNEL MANAGEMENT

====================================================



Support unlimited Telegram channels.



Every channel must have:



• Telegram Channel ID



• Title



• Username



• Archive Channel



• Status



Store all information inside PostgreSQL.



====================================================

ARCHIVE SYSTEM

====================================================



Whenever a new scientific post is published inside a registered channel:



Automatically detect it.



Read metadata.



Store all information in PostgreSQL.



Copy the content to the archive channel.



Store archive logs.



====================================================

FILE TYPES

====================================================



Support:



PDF



DOC



DOCX



PPT



PPTX



XLS



XLSX



ZIP



RAR



Images



Videos



Audio



Links



Text



====================================================

HASHTAG SYSTEM

====================================================



Extract hashtags automatically.



If hashtags do not exist,



generate intelligent hashtags.



Store hashtags in PostgreSQL.



====================================================

SEARCH

====================================================



Prepare a high-performance search engine.



Support searching by:



Title



Subject



Category



File Type



Hashtags



Channel



Date



====================================================

STATISTICS

====================================================



Prepare statistics for:



Channels



Files



Categories



Subjects



PDF



Word



PowerPoint



Images



Videos



Archive



====================================================

REPORTS

====================================================



Prepare reports:



Daily



Weekly



Monthly



Yearly



Support:



PDF



Excel



====================================================

LOGGING

====================================================



Log every important action.



Log all errors.



Log all administrator activities.



====================================================

SECURITY

====================================================



Validate every input.



Protect BOT_TOKEN.



Protect DATABASE_URL.



Prevent duplicate Telegram File IDs.



Prevent duplicate Telegram Message IDs.



====================================================

ERROR HANDLING

====================================================



Global error handler.



No application crashes.



Graceful recovery.



====================================================

DEPLOYMENT

====================================================



The final project must be deployable without changing the code.



Support:



GitHub



Render



Oracle Cloud



Docker



====================================================

IMPORTANT

====================================================



Do NOT generate everything in one response.



Implement the project step-by-step inside the same project while preserving the architecture.



Never redesign the project after implementation starts.



Never replace PostgreSQL.



Never use Lovable built-in database.



The final result must be an enterprise-grade Telegram Scientific Content Management Platform suitable for thousands of channels and millions of files.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://synthia-archive-libk.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5e6b50b1-8a5f-46ea-a110-5405aca14a21).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `synthia-archive-link.lovable.app` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

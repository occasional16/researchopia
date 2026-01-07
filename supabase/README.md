# Supabase Database Schema

> Database migrations for Researchopia platform  
> Generated from production database: 2026-01-07

## Structure

```
supabase/
├── config.toml                           # Local Supabase configuration
├── migrations/                           # Database migrations (version controlled)
│   ├── 001_core_schema.sql               # Users, papers, ratings, comments
│   ├── 002_documents_annotations.sql     # Documents, annotations system
│   ├── 003_reading_sessions.sql          # Co-reading sessions
│   ├── 004_knowledge_web.sql             # Knowledge units, links, tags
│   ├── 005_webpage_evaluation.sql        # Webpage rating system
│   ├── 006_system_tables.sql             # Announcements, notifications, etc.
│   ├── 007_rls_policies.sql              # Row Level Security policies
│   └── 008_triggers_functions.sql        # Auto-update triggers
├── seed.sql                              # Development test data
└── README.md                             # This file
```

## Database Overview (38 Tables)

| Category | Tables |
|----------|--------|
| **Core** | users, papers, ratings, comments, comment_votes, paper_favorites, user_follows |
| **Documents** | documents, annotations, annotation_likes, annotation_comments, annotation_shares |
| **Sessions** | reading_sessions, session_members, session_annotations, session_chat, session_logs |
| **Knowledge Web** | knowledge_units, knowledge_links, tags, unit_tags, kn_collections, collection_units, kn_notes |
| **Webpage** | webpages, webpage_ratings, webpage_comments |
| **System** | announcements, notifications, user_activities, user_comment_preferences, paper_reports, paper_reading_history, visit_counters, daily_visit_stats, plugin_version_config, collaboration_sessions |

## Quick Start for Team Members

### 1. Create Your Own Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Copy the project URL and anon key
3. Create `.env.local` from template:
   ```bash
   cp .env.example .env.local
   # Edit with your Supabase credentials
   ```

### 2. Apply Migrations

**Option A: Via Supabase Dashboard**
1. Go to SQL Editor in your Supabase Dashboard
2. Run each migration file in order (000000 → 000001 → ...)

**Option B: Via Supabase CLI**
```bash
# Install CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

**Option C: Via AI + MCP**
```
Prompt: "Please apply all migrations from supabase/migrations/ to my development database"
```

### 3. Seed Test Data (Optional)

```bash
# Via CLI
supabase db reset  # This applies migrations + seed.sql

# Or manually run seed.sql in SQL Editor
```

## Migration Naming Convention

```
{timestamp}_{description}.sql

Example:
20260107000000_initial_schema.sql
20260107000001_rls_policies.sql
20260107000002_paper_ratings.sql
```

## Adding New Migrations

1. Create new file with next timestamp:
   ```
   supabase/migrations/20260107000004_new_feature.sql
   ```

2. Write your SQL (see existing files for template)

3. Test locally

4. Commit and push:
   ```bash
   git add supabase/migrations/
   git commit -m "feat(db): add new_feature tables"
   git push
   ```

## Important Notes

- **DO NOT** modify existing migration files after they've been applied
- **DO** create new migration files for schema changes
- **DO** include both CREATE and DROP statements (commented) for rollback
- **DO NOT** commit sensitive data (use seed.sql only for test data)

## Related Documentation

- [Team Collaboration Guide](../docs/dev/15-Supabase-Team-Collaboration-Guide.md)
- [Architecture - Database Design](../docs/ARCHITECTURE.md#四数据库设计)

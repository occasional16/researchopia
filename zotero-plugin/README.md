# Researchopia - Zotero Annotation Sharing Plugin

Academic annotation sharing and real-time collaboration for Zotero, compatible with Zotero 8.

## 🚀 Features

- **Annotation Sharing**: Share your Zotero annotations with the research community
- **Community Annotations**: View annotations from other researchers on papers with DOIs
- **Social Features**: Like, comment, and follow annotation authors
- **Quality Scoring**: Smart ranking of annotations based on quality and engagement
- **Real-time Updates**: Live annotation display in Zotero's item pane
- **Supabase Integration**: Secure cloud storage and authentication
- **Zotero 8 Compatible**: Fully optimized for the latest Zotero version

## � Installation

### For Users

1. Download the latest XPI file from [Releases](https://github.com/occasional15/researchopia/releases)
2. In Zotero, go to Tools → Add-ons
3. Click the gear icon and select "Install Add-on From File"
4. Select the downloaded XPI file
5. Restart Zotero

### For Developers

#### Prerequisites

- [Zotero 8 Beta](https://www.zotero.org/support/beta_builds)
- [Node.js](https://nodejs.org/) (LTS version)
- [Git](https://git-scm.com/)

#### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/occasional15/researchopia.git
   cd researchopia/zotero-plugin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure development environment:
   ```bash
   cp .env.template .env
   # Edit .env and set your Zotero executable path
   ```

4. Set up Supabase (optional):
   - Create a [Supabase](https://supabase.com) project
   - Update `.env` with your Supabase URL and anon key
   - Import the database schema from `supabase-schema.sql`

## 🛠 Development

### Hot Reload Development

The plugin supports hot reload for rapid development:

```bash
# Start development server with hot reload
npm start
```

This will:
- Start Zotero with the plugin loaded
- Watch for file changes in `src/` and `addon/`
- Automatically rebuild and reload the plugin when changes are detected
- Show detailed logging for debugging

### Building

```bash
# Build for production
npm run build

# Build and create XPI package
npm run release
```

### Testing

```bash
# Run tests
npm test

# Run linting
npm run lint:check
npm run lint:fix
```

## 🎯 Usage

### Basic Workflow

1. **Login**: Open Zotero preferences → Researchopia → Login with your account
2. **Share Annotations**: Select papers with DOIs and click "Share My Annotations"
3. **View Community Annotations**: Select any paper to see shared annotations in the item pane
4. **Engage**: Like, comment, and follow other researchers' annotations

### Item Pane Integration

- **Community Annotations Tab**: Shows all shared annotations for the selected paper
- **Real-time Updates**: New annotations appear automatically
- **Interactive Features**: Click to like, comment, or follow authors
- **Quality Ranking**: Best annotations appear first

### Supported Papers

- Papers must have a valid DOI to access community annotations
- Works with all Zotero item types that support DOIs
- PDF annotations are automatically extracted and shared

## 🔧 Configuration

### Environment Setup

Copy `.env.template` to `.env` and configure:

```bash
# Zotero executable path (required for development)
ZOTERO_PLUGIN_ZOTERO_BIN_PATH=C:\Program Files\Zotero\zotero.exe

# Supabase credentials (optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Database Schema

Run the following SQL in your Supabase project:

```sql
-- Shared annotations table
CREATE TABLE shared_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doi TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  annotation_text TEXT,
  annotation_comment TEXT,
  page_number INTEGER,
  position JSONB,
  annotation_type TEXT,
  annotation_color TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Likes table
CREATE TABLE annotation_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID REFERENCES shared_annotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(annotation_id, user_id)
);

-- Comments table
CREATE TABLE annotation_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID REFERENCES shared_annotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User follows table
CREATE TABLE user_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id),
  following_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);
```

## 🐛 Troubleshooting

### Common Issues

**Hot reload not working:**
- Check that `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` is correctly set in `.env`
- Ensure Zotero is not already running
- Try deleting `.scaffold/` directory and rebuilding

**Authentication failures:**
- Verify Supabase credentials in `.env`
- Check network connection
- Ensure Supabase project is properly configured

**Annotations not appearing:**
- Verify paper has a valid DOI
- Check that you're logged in
- Try refreshing by reselecting the item

## 📄 License

This project is licensed under the AGPL-3.0-or-later License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Windingwind's Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
- Uses [Zotero Plugin Toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
- Powered by [Supabase](https://supabase.com) for backend services

---

Made with ❤️ for the research community

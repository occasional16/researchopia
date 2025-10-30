import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 导出会议纪要(Markdown格式)
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ success: false, message: 'Supabase未配置' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const format = searchParams.get('format') || 'markdown'; // markdown | html
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!sessionId) {
      return NextResponse.json({ success: false, message: '缺少session_id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, anonKey);

    await supabase.auth.setSession({
      access_token: token,
      refresh_token: ''
    });

    // 1. 获取会话信息
    const { data: session, error: sessionError } = await supabase
      .from('reading_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ success: false, message: '会话不存在' }, { status: 404 });
    }

    // 2. 获取成员列表
    const { data: members } = await supabase
      .from('session_members')
      .select('*')
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true });

    // 3. 获取事件日志
    let logsQuery = supabase
      .from('session_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (startDate) logsQuery = logsQuery.gte('created_at', startDate);
    if (endDate) logsQuery = logsQuery.lte('created_at', endDate);

    const { data: logs } = await logsQuery;

    // 4. 获取聊天记录
    let chatQuery = supabase
      .from('session_chat')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (startDate) chatQuery = chatQuery.gte('created_at', startDate);
    if (endDate) chatQuery = chatQuery.lte('created_at', endDate);

    const { data: chats } = await chatQuery;

    // 5. 生成Markdown内容
    const content = generateMarkdown(session, members || [], logs || [], chats || []);

    if (format === 'html') {
      // 简单的Markdown to HTML转换
      const html = markdownToHtml(content);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="session_minutes_${sessionId}.html"`
        }
      });
    }

    // 默认返回Markdown
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="session_minutes_${sessionId}.md"`
      }
    });

  } catch (error: any) {
    console.error('[Export API] Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '导出失败'
    }, { status: 500 });
  }
}

/**
 * 生成Markdown格式的会议纪要
 */
function generateMarkdown(session: any, members: any[], logs: any[], chats: any[]): string {
  const lines: string[] = [];

  lines.push(`# ${session.paper_title} - 文献共读纪要`);
  lines.push('');
  lines.push(`**会话ID**: ${session.id}`);
  lines.push(`**DOI**: ${session.paper_doi}`);
  lines.push(`**创建时间**: ${new Date(session.created_at).toLocaleString('zh-CN')}`);
  lines.push(`**会话类型**: ${session.session_type === 'public' ? '公开' : '私密'}`);
  lines.push(`**邀请码**: ${session.invite_code || 'N/A'}`);
  lines.push('');

  // 成员列表
  lines.push('## 📋 参与成员');
  lines.push('');
  if (members.length === 0) {
    lines.push('暂无成员');
  } else {
    members.forEach((member, index) => {
      const joinTime = new Date(member.joined_at).toLocaleString('zh-CN');
      const status = member.is_online ? '🟢 在线' : '⚫ 离线';
      const role = member.user_id === session.host_id ? '(主持人)' : '';
      lines.push(`${index + 1}. **${member.user_name || member.user_email}** ${role} - ${status} - 加入于 ${joinTime}`);
    });
  }
  lines.push('');

  // 事件日志
  lines.push('## 📝 事件记录');
  lines.push('');
  if (logs.length === 0) {
    lines.push('暂无事件记录');
  } else {
    logs.forEach(log => {
      const time = new Date(log.created_at).toLocaleString('zh-CN');
      const icon = getEventIcon(log.event_type);
      const desc = formatEventDescription(log);
      lines.push(`- ${icon} **${time}** - ${log.actor_name || '未知用户'}: ${desc}`);
    });
  }
  lines.push('');

  // 聊天记录
  lines.push('## 💬 聊天记录');
  lines.push('');
  if (chats.length === 0) {
    lines.push('暂无聊天记录');
  } else {
    chats.forEach(chat => {
      const time = new Date(chat.created_at).toLocaleString('zh-CN');
      lines.push(`**${chat.user_name || '未知用户'}** (${time}):`);
      lines.push(`> ${chat.message}`);
      lines.push('');
    });
  }

  lines.push('---');
  lines.push(`*导出时间: ${new Date().toLocaleString('zh-CN')}*`);

  return lines.join('\n');
}

/**
 * 获取事件图标
 */
function getEventIcon(eventType: string): string {
  const icons: { [key: string]: string } = {
    'member_join': '✅',
    'member_leave': '👋',
    'annotation_create': '📝',
    'annotation_update': '✏️',
    'annotation_delete': '🗑️',
    'annotation_comment': '💬'
  };
  return icons[eventType] || '📌';
}

/**
 * 格式化事件描述
 */
function formatEventDescription(log: any): string {
  const metadata = log.metadata || {};
  
  switch (log.event_type) {
    case 'member_join':
      return '加入了会话';
    case 'member_leave':
      return '离开了会话';
    case 'annotation_create':
      return `在第${metadata.page_number || '?'}页创建了标注: "${metadata.content || ''}"`;
    case 'annotation_update':
      return `更新了第${metadata.page_number || '?'}页的标注`;
    case 'annotation_delete':
      return `删除了第${metadata.page_number || '?'}页的标注`;
    case 'annotation_comment':
      return `评论了标注: "${metadata.comment || ''}"`;
    default:
      return log.event_type;
  }
}

/**
 * 简单的Markdown转HTML
 */
function markdownToHtml(markdown: string): string {
  let html = markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  html = '<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;line-height:1.6;}h1{color:#2c3e50;}h2{color:#34495e;border-bottom:2px solid #eee;padding-bottom:10px;}li{margin:5px 0;}</style></head><body><p>' + html + '</p></body></html>';

  return html;
}

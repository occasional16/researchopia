import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, message: 'Supabase未配置' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 直接创建表结构(如果不存在)
    // 注意:这是一个简化版本,在生产环境应该用proper migrations
    console.log('[Admin] 初始化session_logs和session_chat表...');
    
    // 创建session_logs表的测试(通过插入/删除来验证表存在)
    const { error: logsTestError } = await supabase
      .from('session_logs')
      .select('id')
      .limit(1);

    const { error: chatTestError } = await supabase
      .from('session_chat')
      .select('id')
      .limit(1);

    if (logsTestError || chatTestError) {
      return NextResponse.json({
        success: false,
        message: '表不存在,请手动在Supabase Dashboard执行create_session_logs_and_chat.sql',
        details: {
          logsError: logsTestError?.message,
          chatError: chatTestError?.message
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'session_logs和session_chat表已存在并可用'
    });

  } catch (error: any) {
    console.error('[Admin] Error checking tables:', error);
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: '请使用POST方法初始化表'
  });
}

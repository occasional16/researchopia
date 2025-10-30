import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * 管理员专用 - 执行数据库迁移
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ 
      success: false, 
      message: 'Supabase未配置' 
    }, { status: 500 });
  }

  try {
    const { migrationFile } = await request.json();
    
    if (!migrationFile) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少迁移文件名' 
      }, { status: 400 });
    }

    // 读取迁移文件
    const migrationPath = path.join(process.cwd(), 'src', 'database', 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      return NextResponse.json({ 
        success: false, 
        message: `迁移文件不存在: ${migrationFile}` 
      }, { status: 404 });
    }

    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

    // 使用Service Role Key创建Supabase客户端(超级权限)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 执行SQL (分段执行,因为CREATE INDEX不能在同一事务中)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    const results = [];
    for (const statement of statements) {
      if (!statement) continue;
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_query: statement 
        });

        if (error) {
          // 如果是"已存在"错误,继续执行
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            results.push({ statement: statement.substring(0, 50) + '...', status: 'skipped', message: '对象已存在' });
            continue;
          }
          throw error;
        }

        results.push({ statement: statement.substring(0, 50) + '...', status: 'success' });
      } catch (execError: any) {
        results.push({ 
          statement: statement.substring(0, 50) + '...', 
          status: 'error', 
          message: execError.message 
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `迁移完成: ${migrationFile}`,
      results
    });

  } catch (error: any) {
    console.error('[Admin Migrate] Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '迁移失败'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { password, confirmText } = await request.json()

    // 验证确认文本
    if (confirmText !== '删除我的账户') {
      return NextResponse.json({
        success: false,
        message: '请输入正确的确认文本'
      }, { status: 400 })
    }

    if (!password) {
      return NextResponse.json({
        success: false,
        message: '请输入当前密码'
      }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        message: '服务配置错误'
      }, { status: 500 })
    }

    // 从请求头获取认证信息
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '未授权访问'
      }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, anonKey)

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: '用户认证失败'
      }, { status: 401 })
    }

    // 验证当前密码
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: password
    })

    if (signInError) {
      return NextResponse.json({
        success: false,
        message: '密码错误'
      }, { status: 400 })
    }

    // 检查是否为管理员账户
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      return NextResponse.json({
        success: false,
        message: '管理员账户不能被删除'
      }, { status: 403 })
    }

    // 使用Service Role Key删除用户数据
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

    try {
      console.log('🗑️ Starting account deletion for user:', user.id)

      // 1. 删除用户相关数据（按依赖关系顺序删除）

      // 1.1. 删除评论投票（如果存在）
      console.log('🗑️ Deleting comment votes...')
      const { error: votesError } = await adminSupabase
        .from('comment_votes')
        .delete()
        .eq('user_id', user.id)

      if (votesError) {
        console.error('Error deleting comment votes:', votesError)
        // 继续执行，不阻止删除
      }

      // 1.2. 删除用户评论
      console.log('🗑️ Deleting user comments...')
      const { error: commentsError } = await adminSupabase
        .from('comments')
        .delete()
        .eq('user_id', user.id)

      if (commentsError) {
        console.error('Error deleting comments:', commentsError)
        // 继续执行，不阻止删除
      }

      // 1.3. 删除用户评分
      console.log('🗑️ Deleting user ratings...')
      const { error: ratingsError } = await adminSupabase
        .from('ratings')
        .delete()
        .eq('user_id', user.id)

      if (ratingsError) {
        console.error('Error deleting ratings:', ratingsError)
        // 继续执行，不阻止删除
      }

      // 1.4. 删除用户收藏
      console.log('🗑️ Deleting user favorites...')
      const { error: favoritesError } = await adminSupabase
        .from('paper_bookmark_items')
        .delete()
        .eq('user_id', user.id)

      if (favoritesError) {
        console.error('Error deleting favorites:', favoritesError)
        // 继续执行，不阻止删除
      }

      // 1.5. 处理用户创建的论文 - 必须在删除用户之前完成
      console.log('🗑️ Handling user-created papers...')
      const { data: userPapers, error: papersCheckError } = await adminSupabase
        .from('papers')
        .select('id, title, created_by')
        .eq('created_by', user.id)

      if (papersCheckError) {
        console.error('Error checking user papers:', papersCheckError)
        return NextResponse.json({
          success: false,
          message: `检查用户论文时出错：${papersCheckError.message}`
        }, { status: 500 })
      }

      if (userPapers && userPapers.length > 0) {
        console.log(`Found ${userPapers.length} papers created by user, need to transfer ownership`)

        // 查找指定的管理员用户来接管论文
        const { data: adminUser, error: adminUserError } = await adminSupabase
          .from('users')
          .select('id, username, email')
          .or('email.eq.fengboswu@email.swu.edu.cn,username.eq.admin')
          .limit(1)

        if (adminUserError) {
          console.error('Error finding admin user:', adminUserError)
          return NextResponse.json({
            success: false,
            message: `查找管理员用户时出错：${adminUserError.message}`
          }, { status: 500 })
        }

        if (!adminUser || adminUser.length === 0) {
          console.log('Admin user not found, cannot transfer papers')
          return NextResponse.json({
            success: false,
            message: `无法删除账户：您创建了 ${userPapers.length} 篇论文，但系统找不到管理员用户（admin 或 fengboswu@email.swu.edu.cn）来接管这些论文。请先确保管理员用户存在。`
          }, { status: 400 })
        }

        // 将论文转移给管理员
        const adminUserId = adminUser[0].id
        console.log(`Transferring ${userPapers.length} papers to admin user: ${adminUser[0].username || adminUser[0].email}`)

        const { error: transferError } = await adminSupabase
          .from('papers')
          .update({ created_by: adminUserId })
          .eq('created_by', user.id)

        if (transferError) {
          console.error('Error transferring papers to admin:', transferError)
          return NextResponse.json({
            success: false,
            message: `转移论文所有权失败：${transferError.message}。请联系管理员手动处理。`
          }, { status: 500 })
        }

        console.log('✅ Successfully transferred papers to admin user')
      } else {
        console.log('No papers found for this user')
      }

      // 2. 删除用户档案
      console.log('🗑️ Deleting user profile...')
      const { error: profileError } = await adminSupabase
        .from('users')
        .delete()
        .eq('id', user.id)

      if (profileError) {
        console.error('Error deleting user profile:', profileError)
        return NextResponse.json({
          success: false,
          message: '删除用户档案失败：' + profileError.message
        }, { status: 500 })
      }

      // 3. 删除认证用户
      console.log('🗑️ Deleting auth user...')
      const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id)

      if (deleteError) {
        console.error('Delete user error:', deleteError)
        return NextResponse.json({
          success: false,
          message: '删除认证用户失败：' + deleteError.message
        }, { status: 500 })
      }

      console.log('✅ Account deletion completed successfully')
      return NextResponse.json({
        success: true,
        message: '账户已成功删除'
      })

    } catch (error: any) {
      console.error('Account deletion error:', error)
      return NextResponse.json({
        success: false,
        message: '删除过程中出现错误：' + error.message
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Delete account error:', error)
    return NextResponse.json({
      success: false,
      message: '服务器错误，请重试'
    }, { status: 500 })
  }
}

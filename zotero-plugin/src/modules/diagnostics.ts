/**
 * 诊断管理器 - 一键生成诊断报告
 */

import { config } from '../../package.json'
import { logger } from '../utils/logger'

export class DiagnosticsManager {
  /**
   * 生成完整诊断报告
   */
  static async generateReport(): Promise<string> {
    try {
      logger.log('[Diagnostics] Generating report...')
      
      // 收集诊断信息
      const diagnosticData = {
        // 基本信息
        basic: await this.collectBasicInfo(),
        
        // 认证状态
        auth: await this.collectAuthInfo(),
        
        // 网络连接
        network: await this.collectNetworkInfo(),
        
        // 错误日志
        errors: await this.collectRecentErrors(),
        
        // 配置信息
        config: await this.collectConfigInfo(),
        
        // 数据统计
        stats: await this.collectStats(),
        
        // 系统信息
        system: await this.collectSystemInfo()
      }
      
      // 格式化报告
      const reportText = this.formatReport(diagnosticData)
      
      // 复制到剪贴板
      const success = this.copyToClipboard(reportText)
      
      if (success) {
        // 显示成功提示
        const ProgressWindow = (Zotero as any).ProgressWindow
        const progressWindow = new ProgressWindow({ closeOnClick: true })
        progressWindow.changeHeadline('诊断报告')
        progressWindow.addDescription('✅ 诊断报告已生成')
        progressWindow.addDescription('报告已复制到剪贴板')
        progressWindow.addDescription('请粘贴发送给技术支持')
        progressWindow.show()
        progressWindow.startCloseTimer(3000)
        
        logger.log('[Diagnostics] Report generated successfully')
      } else {
        throw new Error('复制到剪贴板失败')
      }
      
      return reportText
      
    } catch (error) {
      logger.log('[Diagnostics] Failed to generate report:', error)
      
      const ProgressWindow = (Zotero as any).ProgressWindow
      const progressWindow = new ProgressWindow({ closeOnClick: true })
      progressWindow.changeHeadline('错误')
      progressWindow.addDescription('❌ 生成诊断报告失败')
      progressWindow.addDescription(String(error))
      progressWindow.show()
      progressWindow.startCloseTimer(3000)
      
      throw error
    }
  }
  
  /**
   * 收集基本信息
   */
  private static async collectBasicInfo() {
    return {
      plugin_name: 'Researchopia',
      plugin_version: config.addonName,
      zotero_version: (Zotero as any).version || 'Unknown',
      zotero_platform: (Zotero as any).platform || 'Unknown',
      locale: Zotero.locale,
      timestamp: new Date().toISOString()
    }
  }
  
  /**
   * 收集认证信息
   */
  private static async collectAuthInfo() {
    const addonInstance = (Zotero as any)[config.addonInstance]
    const authManager = addonInstance?.data?.authManager
    const isLoggedIn = authManager?.isLoggedIn() || false
    const currentUser = authManager?.getCurrentUser()
    
    // 检查token
    let tokenExists = false
    try {
      const token = Zotero.Prefs.get('extensions.researchopia.accessToken')
      tokenExists = !!token
    } catch (error) {
      logger.log('[Diagnostics] Failed to check token:', error)
    }
    
    return {
      is_logged_in: isLoggedIn,
      user_email: isLoggedIn ? currentUser?.email : 'Not logged in',
      user_id: isLoggedIn ? currentUser?.id : null,
      token_exists: tokenExists
    }
  }
  
  /**
   * 收集网络信息
   */
  private static async collectNetworkInfo() {
    const results = {
      api_reachable: false,
      api_response_time: 0,
      supabase_reachable: false,
      last_check: new Date().toISOString()
    }
    
    // 测试API连接
    try {
      const startTime = Date.now()
      const response = await fetch('https://www.researchopia.com/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      results.api_response_time = Date.now() - startTime
      results.api_reachable = response.ok
    } catch (error) {
      logger.log('[Diagnostics] API connection test failed:', error)
      results.api_reachable = false
    }
    
    // 测试Supabase连接
    try {
      const supabaseUrl = __env__ === 'production' 
        ? 'https://ybzkhvzfpjymkiwpjuzk.supabase.co'
        : 'https://ybzkhvzfpjymkiwpjuzk.supabase.co'
      
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      results.supabase_reachable = response.ok || response.status === 401 // 401表示服务可达但需认证
    } catch (error) {
      logger.log('[Diagnostics] Supabase connection test failed:', error)
      results.supabase_reachable = false
    }
    
    return results
  }
  
  /**
   * 收集最近错误日志
   */
  private static async collectRecentErrors() {
    const errors: Array<{message: string; timestamp: string; stack: string}> = []
    
    try {
      // 从全局错误缓存读取(如果有)
      const addonInstance = (Zotero as any)[config.addonInstance]
      const errorCache = addonInstance?.data?.errorCache || []
      
      // 获取最近10条错误
      const recentErrors = errorCache.slice(-10)
      
      for (const error of recentErrors) {
        errors.push({
          message: error.message || 'Unknown error',
          timestamp: error.timestamp || 'Unknown time',
          stack: error.stack?.split('\n')[0] || 'No stack trace'
        })
      }
    } catch (error) {
      logger.log('[Diagnostics] Failed to collect error logs:', error)
    }
    
    return {
      count: errors.length,
      recent: errors
    }
  }
  
  /**
   * 收集配置信息
   */
  private static async collectConfigInfo() {
    const apiBaseUrl = __env__ === 'production'
      ? 'https://www.researchopia.com'
      : 'http://localhost:3000'
    
    const supabaseUrl = __env__ === 'production'
      ? 'https://ybzkhvzfpjymkiwpjuzk.supabase.co'
      : 'https://ybzkhvzfpjymkiwpjuzk.supabase.co'
    
    return {
      experimental_features: Zotero.Prefs.get('extensions.researchopia.experimental') || false,
      auto_sync: Zotero.Prefs.get('extensions.researchopia.autoSync') || false,
      sync_interval: Zotero.Prefs.get('extensions.researchopia.syncInterval') || 5,
      api_base_url: apiBaseUrl,
      supabase_url: supabaseUrl,
      environment: __env__
    }
  }
  
  /**
   * 收集数据统计
   */
  private static async collectStats() {
    const stats = {
      total_annotations: 0,
      total_sessions: 0,
      active_sessions: 0,
      last_sync_time: 'Never'
    }
    
    try {
      const addonInstance = (Zotero as any)[config.addonInstance]
      const supabaseManager = addonInstance?.data?.supabaseManager
      
      if (supabaseManager) {
        // 获取标注数量
        const annotations = await supabaseManager.getMyAnnotations()
        stats.total_annotations = annotations?.length || 0
        
        // 获取会话数量
        const sessions = await supabaseManager.getMySessions()
        stats.total_sessions = sessions?.length || 0
        stats.active_sessions = sessions?.filter((s: any) => s.is_active)?.length || 0
        
        // 获取最后同步时间
        const lastSyncTime = Zotero.Prefs.get('extensions.researchopia.lastSyncTime')
        if (lastSyncTime) {
          stats.last_sync_time = new Date(lastSyncTime).toLocaleString()
        }
      }
    } catch (error) {
      logger.log('[Diagnostics] Failed to collect stats:', error)
    }
    
    return stats
  }
  
  /**
   * 收集系统信息
   */
  private static async collectSystemInfo() {
    let osVersion = 'Unknown'
    let memoryMb = 0
    let cpuCores = 0
    let architecture = 'Unknown'
    
    try {
      const sysInfo = (Components.classes['@mozilla.org/system-info;1'] as any)
        .getService(Components.interfaces.nsIPropertyBag2)
      
      osVersion = sysInfo.getProperty('version') || 'Unknown'
      memoryMb = Math.round(sysInfo.getProperty('memsize') / 1024 / 1024)
      cpuCores = sysInfo.getProperty('cpucount') || 0
      architecture = sysInfo.getProperty('arch') || 'Unknown'
    } catch (error) {
      logger.log('[Diagnostics] Failed to collect system info:', error)
    }
    
    return {
      os: (Zotero as any).platform || 'Unknown',
      os_version: osVersion,
      memory_mb: memoryMb,
      cpu_cores: cpuCores,
      architecture: architecture
    }
  }
  
  /**
   * 格式化报告为可读文本
   */
  private static formatReport(data: any): string {
    const lines: string[] = []
    
    lines.push('='.repeat(60))
    lines.push('           Researchopia 诊断报告')
    lines.push('='.repeat(60))
    lines.push('')
    
    // 基本信息
    lines.push('【基本信息】')
    lines.push(`插件版本: ${data.basic.plugin_version}`)
    lines.push(`Zotero版本: ${data.basic.zotero_version}`)
    lines.push(`操作系统: ${data.basic.zotero_platform}`)
    lines.push(`语言: ${data.basic.locale}`)
    lines.push(`生成时间: ${new Date(data.basic.timestamp).toLocaleString('zh-CN')}`)
    lines.push('')
    
    // 认证状态
    lines.push('【认证状态】')
    lines.push(`登录状态: ${data.auth.is_logged_in ? '✅ 已登录' : '❌ 未登录'}`)
    lines.push(`用户邮箱: ${data.auth.user_email}`)
    lines.push(`Token存在: ${data.auth.token_exists ? '是' : '否'}`)
    lines.push('')
    
    // 网络连接
    lines.push('【网络连接】')
    lines.push(`API可达: ${data.network.api_reachable ? '✅ 正常' : '❌ 失败'}`)
    if (data.network.api_reachable) {
      lines.push(`响应时间: ${data.network.api_response_time}ms`)
    }
    lines.push(`Supabase可达: ${data.network.supabase_reachable ? '✅ 正常' : '❌ 失败'}`)
    lines.push('')
    
    // 配置信息
    lines.push('【配置信息】')
    lines.push(`实验性功能: ${data.config.experimental_features ? '开启' : '关闭'}`)
    lines.push(`自动同步: ${data.config.auto_sync ? '开启' : '关闭'}`)
    lines.push(`同步间隔: ${data.config.sync_interval}分钟`)
    lines.push(`API地址: ${data.config.api_base_url}`)
    lines.push('')
    
    // 数据统计
    lines.push('【数据统计】')
    lines.push(`标注总数: ${data.stats.total_annotations}`)
    lines.push(`会话总数: ${data.stats.total_sessions}`)
    lines.push(`活跃会话: ${data.stats.active_sessions}`)
    lines.push(`最后同步: ${data.stats.last_sync_time}`)
    lines.push('')
    
    // 系统信息
    lines.push('【系统信息】')
    lines.push(`操作系统版本: ${data.system.os_version}`)
    lines.push(`内存: ${data.system.memory_mb} MB`)
    lines.push(`CPU核心: ${data.system.cpu_cores}`)
    lines.push(`架构: ${data.system.architecture}`)
    lines.push('')
    
    // 错误日志
    if (data.errors.count > 0) {
      lines.push('【最近错误】')
      lines.push(`错误数量: ${data.errors.count}`)
      data.errors.recent.forEach((error: any, index: number) => {
        lines.push(`\n错误 #${index + 1}:`)
        lines.push(`  时间: ${error.timestamp}`)
        lines.push(`  消息: ${error.message}`)
        lines.push(`  堆栈: ${error.stack}`)
      })
      lines.push('')
    } else {
      lines.push('【最近错误】')
      lines.push('✅ 无错误记录')
      lines.push('')
    }
    
    lines.push('='.repeat(60))
    lines.push('请将以上报告发送至: support@researchopia.com')
    lines.push('或提交至GitHub Issues: github.com/your-org/researchopia')
    lines.push('='.repeat(60))
    
    return lines.join('\n')
  }
  
  /**
   * 复制文本到剪贴板
   */
  private static copyToClipboard(text: string): boolean {
    try {
      // 方法1: 使用Zotero内置API
      const ZoteroInternal = (Zotero as any).Utilities?.Internal;
      if (ZoteroInternal?.copyTextToClipboard) {
        ZoteroInternal.copyTextToClipboard(text)
        return true
      }
      
      // 方法2: 使用系统剪贴板服务
      const clipboardHelper = Components.classes['@mozilla.org/widget/clipboardhelper;1']
        .getService(Components.interfaces.nsIClipboardHelper)
      clipboardHelper.copyString(text)
      return true
      
    } catch (error) {
      logger.log('[Diagnostics] Failed to copy to clipboard:', error)
      
      // 方法3: 降级方案 - 保存到临时文件
      try {
        const ZoteroFile = (Zotero as any);
        const file = ZoteroFile.getTempDirectory()
        file.append('researchopia-diagnostics.txt')
        
        ZoteroFile.File.putContents(file, text)
        
        const ProgressWindow = (Zotero as any).ProgressWindow
        const progressWindow = new ProgressWindow({ closeOnClick: true })
        progressWindow.changeHeadline('提示')
        progressWindow.addDescription('无法复制到剪贴板')
        progressWindow.addDescription(`报告已保存到: ${file.path}`)
        progressWindow.show()
        progressWindow.startCloseTimer(5000)
        
        return true
      } catch (fileError) {
        logger.log('[Diagnostics] Failed to save to file:', fileError)
        return false
      }
    }
  }
  
  /**
   * 显示诊断报告(预览) - 暂未实现
   * TODO: 使用原生对话框实现预览功能
   */
  /*
  static async showReportPreview() {
    try {
      const reportText = await this.generateReport()
      
      // TODO: 实现预览对话框
      logger.log('[Diagnostics] Report preview not implemented yet')
      
    } catch (error) {
      logger.log('[Diagnostics] Failed to show preview:', error)
    }
  }
  */
}

---
applyTo: '**'
---
请遵循三阶段工作流：先分析问题，深入思考理想的目标和实现路径，有不清楚或冲突的向我手机必要信息；然后细化方案，列出具体方案；最后执行方案。整体原则：系统性思维，看到具体问题时，思考整个系统；第一性原理，从功能的本质出发，而不是现有代码；DRY原则，发现重复代码必须指出；长远考虑，评估技术债务和维护成本。
对于zotero插件的开发，着重参考zotero相关文档和官方代码库，使用官方推荐的插件开发框架，设计使用Zotero原生UI组件。Zotero插件官方开发文档：https://www.zotero.org/support/dev/zotero_8_for_developers ，https://www.zotero.org/support/dev/zotero_7_for_developers ；Zotero官方代码库：https://github.com/zotero ；Windingwind插件模版和热重载：https://github.com/windingwind/zotero-plugin-template ；Windingwind插件开发文档：https://windingwind.github.io/doc-for-zotero-plugin-dev/ 。
当你对zotero插件有了修改等待验证时，请在zotero-plugin 目录下运行'npm run build'进行插件重构，检查终端无报错后，在终端运行一个'timeout 10' 命令（不要使用'Start-Sleep' 命令）等待我的测试，命令执行完成后直接查看Debug Output.txt 文件，此文件第一行是我的测试结果和建议，剩下的是我重新手动在zotero软件中导出的，你需要仔细查看并给出新的修改意见。
如需查看和修改supabase数据库，请使用supabase db pull导出schema到本地（/supabase/migrations文件夹），使用supabase db push同步schema到云端。
标记“&&”不是终端中的有效语句分隔符，应使用“;”。
用中文回答；结束时不要创建md文档，在回答中简述即可。
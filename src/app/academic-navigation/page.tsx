'use client'

import { useState } from 'react'
import { Search, ExternalLink, Globe, BookOpen, Microscope, Database, Award, Users, TrendingUp, FileText, Building, Cpu, Beaker, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

// 资源类型定义
interface Resource {
  name: string
  url: string
  description: string
  tags: string[]
}

interface Category {
  title: string
  icon: LucideIcon
  color: string
  resources: Resource[]
}

interface AcademicResourcesType {
  [key: string]: Category
}

// 学术资源分类数据
const academicResources: AcademicResourcesType = {
  // 学术搜索与数据库
  searchAndDatabase: {
    title: '📚 学术搜索与数据库',
    icon: Database,
    color: 'blue',
    resources: [
      {
        name: 'Google Scholar',
        url: 'https://scholar.google.com',
        description: '最全面的学术搜索引擎，覆盖各学科领域文献',
        tags: ['搜索', '引用分析', '免费']
      },
      {
        name: 'Web of Science',
        url: 'https://www.webofscience.com',
        description: 'SCI/SSCI/A&HCI权威引文数据库',
        tags: ['核心期刊', 'SCI', '引文分析']
      },
      {
        name: 'Scopus',
        url: 'https://www.scopus.com',
        description: 'Elsevier旗下全球最大摘要与引文数据库',
        tags: ['EI', '引文分析', '多学科']
      },
      {
        name: 'PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov',
        description: '生物医学领域最权威的文献数据库',
        tags: ['医学', '生物', '免费']
      },
      {
        name: '中国知网 CNKI',
        url: 'https://www.cnki.net',
        description: '中国最大的学术文献数据库',
        tags: ['中文', '期刊', '学位论文']
      },
      {
        name: '万方数据',
        url: 'https://www.wanfangdata.com.cn',
        description: '中国学术期刊、学位论文、会议论文数据库',
        tags: ['中文', '期刊', '专利']
      },
      {
        name: 'IEEE Xplore',
        url: 'https://ieeexplore.ieee.org',
        description: '电气电子工程领域顶级数据库',
        tags: ['工程', '计算机', 'IEEE']
      },
      {
        name: 'arXiv',
        url: 'https://arxiv.org',
        description: '物理、数学、计算机科学预印本服务器',
        tags: ['预印本', '免费', '最新研究']
      },
      {
        name: 'bioRxiv',
        url: 'https://www.biorxiv.org',
        description: '生物学领域预印本服务器',
        tags: ['生物', '预印本', '免费']
      },
      {
        name: 'SSRN',
        url: 'https://www.ssrn.com',
        description: '社会科学研究网络',
        tags: ['社科', '预印本', '多学科']
      }
    ]
  },

  // 期刊与出版商
  journalsAndPublishers: {
    title: '📖 期刊与出版商',
    icon: BookOpen,
    color: 'green',
    resources: [
      {
        name: 'Nature',
        url: 'https://www.nature.com',
        description: '世界顶级综合性科学期刊',
        tags: ['顶刊', '综合', 'IF>50']
      },
      {
        name: 'Science',
        url: 'https://www.science.org',
        description: 'AAAS旗下顶级科学期刊',
        tags: ['顶刊', '综合', 'IF>50']
      },
      {
        name: 'Cell',
        url: 'https://www.cell.com',
        description: '生命科学领域顶级期刊',
        tags: ['顶刊', '生物', 'Cell三刊']
      },
      {
        name: 'Springer Nature',
        url: 'https://www.springernature.com',
        description: '全球最大学术出版商之一',
        tags: ['出版商', '开放获取', '多学科']
      },
      {
        name: 'Elsevier',
        url: 'https://www.elsevier.com',
        description: '全球领先的科技医学出版商',
        tags: ['出版商', 'ScienceDirect', '多学科']
      },
      {
        name: 'Wiley Online Library',
        url: 'https://onlinelibrary.wiley.com',
        description: 'Wiley旗下学术资源平台',
        tags: ['出版商', '期刊', '图书']
      },
      {
        name: 'Taylor & Francis Online',
        url: 'https://www.tandfonline.com',
        description: '人文社科领域重要出版商',
        tags: ['出版商', '社科', '人文']
      },
      {
        name: 'PLOS ONE',
        url: 'https://journals.plos.org/plosone',
        description: '大型开放获取期刊',
        tags: ['开放获取', '综合', '免费']
      },
      {
        name: 'Frontiers',
        url: 'https://www.frontiersin.org',
        description: '开放获取出版平台',
        tags: ['开放获取', '多学科', '同行评审']
      },
      {
        name: 'MDPI',
        url: 'https://www.mdpi.com',
        description: '开放获取学术出版社',
        tags: ['开放获取', '多学科', '快速发表']
      }
    ]
  },

  // 科研基金与项目
  fundingAndGrants: {
    title: '💰 科研基金与项目',
    icon: Award,
    color: 'yellow',
    resources: [
      {
        name: '国家自然科学基金委',
        url: 'https://www.nsfc.gov.cn',
        description: '中国最重要的基础研究资助机构',
        tags: ['国基金', 'NSFC', '中国']
      },
      {
        name: '国家社科基金',
        url: 'http://www.nopss.gov.cn',
        description: '中国人文社科领域国家级基金',
        tags: ['社科', '人文', '中国']
      },
      {
        name: '科技部',
        url: 'https://www.most.gov.cn',
        description: '国家科技计划项目管理',
        tags: ['国家项目', '科技部', '中国']
      },
      {
        name: 'NSF (美国)',
        url: 'https://www.nsf.gov',
        description: '美国国家科学基金会',
        tags: ['美国', '基础研究', '国际']
      },
      {
        name: 'NIH (美国)',
        url: 'https://www.nih.gov',
        description: '美国国立卫生研究院',
        tags: ['美国', '医学', '生物']
      },
      {
        name: 'ERC (欧盟)',
        url: 'https://erc.europa.eu',
        description: '欧洲研究理事会',
        tags: ['欧盟', '高端人才', '国际']
      },
      {
        name: 'Horizon Europe',
        url: 'https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe_en',
        description: '欧盟最大科研创新资助计划',
        tags: ['欧盟', '综合', '国际合作']
      },
      {
        name: 'Gates Foundation',
        url: 'https://www.gatesfoundation.org',
        description: '比尔及梅琳达·盖茨基金会',
        tags: ['健康', '发展', '慈善']
      },
      {
        name: 'Wellcome Trust',
        url: 'https://wellcome.org',
        description: '英国威康信托基金会',
        tags: ['医学', '生物', '英国']
      }
    ]
  },

  // 学术社交与学者主页
  academicSocial: {
    title: '👥 学术社交与学者主页',
    icon: Users,
    color: 'purple',
    resources: [
      {
        name: 'ResearchGate',
        url: 'https://www.researchgate.net',
        description: '全球最大学术社交网络',
        tags: ['社交', '论文分享', '合作']
      },
      {
        name: 'Academia.edu',
        url: 'https://www.academia.edu',
        description: '学者论文分享平台',
        tags: ['社交', '人文社科', '论文共享']
      },
      {
        name: 'ORCID',
        url: 'https://orcid.org',
        description: '学者唯一标识符系统',
        tags: ['学者ID', '身份认证', '免费']
      },
      {
        name: 'Publons',
        url: 'https://publons.com',
        description: '学者同行评审记录平台',
        tags: ['评审', '学术贡献', 'WoS']
      },
      {
        name: 'Loop (Frontiers)',
        url: 'https://loop.frontiersin.org',
        description: 'Frontiers学者社交网络',
        tags: ['社交', '开放科学', '合作']
      },
      {
        name: 'Mendeley',
        url: 'https://www.mendeley.com',
        description: '文献管理与学术社交平台',
        tags: ['文献管理', '社交', 'Elsevier']
      },
      {
        name: 'Zotero',
        url: 'https://www.zotero.org',
        description: '开源文献管理工具',
        tags: ['文献管理', '免费', '开源']
      }
    ]
  },

  // 数据与工具
  dataAndTools: {
    title: '🔬 科研数据与工具',
    icon: Microscope,
    color: 'red',
    resources: [
      {
        name: 'GitHub',
        url: 'https://github.com',
        description: '全球最大开源代码托管平台',
        tags: ['代码', '开源', '合作']
      },
      {
        name: 'Kaggle',
        url: 'https://www.kaggle.com',
        description: '数据科学竞赛与数据集平台',
        tags: ['数据集', 'AI', '竞赛']
      },
      {
        name: 'Figshare',
        url: 'https://figshare.com',
        description: '研究数据存储与分享平台',
        tags: ['数据共享', '开放科学', '免费']
      },
      {
        name: 'Zenodo',
        url: 'https://zenodo.org',
        description: 'CERN旗下开放科学数据库',
        tags: ['数据存储', 'DOI', '免费']
      },
      {
        name: 'Dryad',
        url: 'https://datadryad.org',
        description: '科学数据发布平台',
        tags: ['数据发布', 'DOI', '开放获取']
      },
      {
        name: 'GenBank',
        url: 'https://www.ncbi.nlm.nih.gov/genbank',
        description: 'NIH基因序列数据库',
        tags: ['生物信息', '基因', '免费']
      },
      {
        name: 'Protein Data Bank',
        url: 'https://www.rcsb.org',
        description: '全球蛋白质结构数据库',
        tags: ['蛋白质', '结构生物学', '免费']
      },
      {
        name: 'OpenML',
        url: 'https://www.openml.org',
        description: '机器学习数据集与实验平台',
        tags: ['机器学习', '数据集', '开源']
      },
      {
        name: 'OSF (Open Science Framework)',
        url: 'https://osf.io',
        description: '开放科学协作平台',
        tags: ['开放科学', '项目管理', '免费']
      },
      {
        name: 'Overleaf',
        url: 'https://www.overleaf.com',
        description: '在线LaTeX编辑器',
        tags: ['LaTeX', '论文写作', '协作']
      }
    ]
  },

  // 学术会议与讲座
  conferencesAndTalks: {
    title: '🎓 学术会议与讲座',
    icon: GraduationCap,
    color: 'indigo',
    resources: [
      {
        name: 'Conference Index',
        url: 'https://conferenceindex.org',
        description: '全球学术会议索引',
        tags: ['会议', '多学科', '国际']
      },
      {
        name: 'AllConferences.Com',
        url: 'https://www.allconferences.com',
        description: '会议信息聚合平台',
        tags: ['会议', '检索', '提醒']
      },
      {
        name: '中国学术会议网',
        url: 'http://www.meeting.edu.cn',
        description: '中国学术会议信息平台',
        tags: ['中国', '会议', '中文']
      },
      {
        name: 'TED',
        url: 'https://www.ted.com',
        description: 'TED演讲视频平台',
        tags: ['演讲', '科普', '启发']
      },
      {
        name: 'Coursera',
        url: 'https://www.coursera.org',
        description: '全球顶尖大学在线课程',
        tags: ['在线课程', '学习', '证书']
      },
      {
        name: 'edX',
        url: 'https://www.edx.org',
        description: 'MIT/Harvard在线教育平台',
        tags: ['在线课程', '顶尖大学', '免费']
      },
      {
        name: '中国大学MOOC',
        url: 'https://www.icourse163.org',
        description: '中国高质量在线课程平台',
        tags: ['中文', 'MOOC', '免费']
      }
    ]
  },

  // 科研机构与实验室
  institutions: {
    title: '🏛️ 科研机构与实验室',
    icon: Building,
    color: 'pink',
    resources: [
      {
        name: 'MIT',
        url: 'https://www.mit.edu',
        description: '麻省理工学院',
        tags: ['顶尖大学', '工程', '美国']
      },
      {
        name: 'Stanford',
        url: 'https://www.stanford.edu',
        description: '斯坦福大学',
        tags: ['顶尖大学', '综合', '美国']
      },
      {
        name: 'Harvard',
        url: 'https://www.harvard.edu',
        description: '哈佛大学',
        tags: ['顶尖大学', '综合', '美国']
      },
      {
        name: 'Cambridge',
        url: 'https://www.cam.ac.uk',
        description: '剑桥大学',
        tags: ['顶尖大学', '综合', '英国']
      },
      {
        name: 'Oxford',
        url: 'https://www.ox.ac.uk',
        description: '牛津大学',
        tags: ['顶尖大学', '综合', '英国']
      },
      {
        name: '清华大学',
        url: 'https://www.tsinghua.edu.cn',
        description: '中国顶尖理工科大学',
        tags: ['顶尖大学', '工程', '中国']
      },
      {
        name: '北京大学',
        url: 'https://www.pku.edu.cn',
        description: '中国顶尖综合性大学',
        tags: ['顶尖大学', '综合', '中国']
      },
      {
        name: 'CERN',
        url: 'https://home.cern',
        description: '欧洲核子研究中心',
        tags: ['物理', '大科学装置', '欧洲']
      },
      {
        name: 'Max Planck Society',
        url: 'https://www.mpg.de',
        description: '马克斯·普朗克学会',
        tags: ['基础研究', '德国', '综合']
      },
      {
        name: '中国科学院',
        url: 'https://www.cas.cn',
        description: '中国最高学术机构',
        tags: ['中国', 'CAS', '综合']
      }
    ]
  },

  // 学术评价与排名
  rankingsAndMetrics: {
    title: '📊 学术评价与排名',
    icon: TrendingUp,
    color: 'orange',
    resources: [
      {
        name: 'QS World University Rankings',
        url: 'https://www.topuniversities.com',
        description: 'QS世界大学排名',
        tags: ['大学排名', '综合', '权威']
      },
      {
        name: 'THE World Rankings',
        url: 'https://www.timeshighereducation.com',
        description: '泰晤士高等教育世界大学排名',
        tags: ['大学排名', 'THE', '权威']
      },
      {
        name: 'ARWU',
        url: 'https://www.shanghairanking.com',
        description: '上海软科世界大学学术排名',
        tags: ['大学排名', '学术', '中国']
      },
      {
        name: 'Journal Citation Reports',
        url: 'https://jcr.clarivate.com',
        description: '期刊引证报告(影响因子)',
        tags: ['期刊评价', 'IF', 'Clarivate']
      },
      {
        name: 'CiteScore',
        url: 'https://www.scopus.com/sources',
        description: 'Scopus期刊评价指标',
        tags: ['期刊评价', 'Elsevier', 'Scopus']
      },
      {
        name: 'SCImago Journal Rank',
        url: 'https://www.scimagojr.com',
        description: '基于Scopus的期刊排名',
        tags: ['期刊排名', 'SJR', '免费']
      },
      {
        name: 'ESI (Essential Science Indicators)',
        url: 'https://esi.clarivate.com',
        description: '基本科学指标数据库',
        tags: ['学科排名', '高被引', 'Clarivate']
      },
      {
        name: 'Altmetric',
        url: 'https://www.altmetric.com',
        description: '论文替代计量学指标',
        tags: ['影响力', '社交媒体', '新指标']
      }
    ]
  },

  // 专利与知识产权
  patentsAndIP: {
    title: '⚖️ 专利与知识产权',
    icon: FileText,
    color: 'gray',
    resources: [
      {
        name: 'Google Patents',
        url: 'https://patents.google.com',
        description: '谷歌专利搜索引擎',
        tags: ['专利检索', '免费', '全球']
      },
      {
        name: '中国专利公布公告',
        url: 'http://epub.cnipa.gov.cn',
        description: '国家知识产权局专利检索',
        tags: ['中国专利', '官方', '免费']
      },
      {
        name: 'USPTO',
        url: 'https://www.uspto.gov',
        description: '美国专利商标局',
        tags: ['美国专利', '官方', '免费']
      },
      {
        name: 'EPO (Espacenet)',
        url: 'https://worldwide.espacenet.com',
        description: '欧洲专利局专利检索',
        tags: ['欧洲专利', '免费', '多语言']
      },
      {
        name: 'WIPO',
        url: 'https://www.wipo.int',
        description: '世界知识产权组织',
        tags: ['国际专利', 'PCT', '官方']
      },
      {
        name: 'Lens.org',
        url: 'https://www.lens.org',
        description: '专利与学术文献关联平台',
        tags: ['专利分析', '免费', '可视化']
      }
    ]
  },

  // AI与计算工具
  aiAndComputing: {
    title: '🤖 AI与计算工具',
    icon: Cpu,
    color: 'teal',
    resources: [
      {
        name: 'Google Colab',
        url: 'https://colab.research.google.com',
        description: '免费Jupyter Notebook云计算平台',
        tags: ['Python', 'GPU', '免费']
      },
      {
        name: 'Hugging Face',
        url: 'https://huggingface.co',
        description: 'AI模型与数据集社区',
        tags: ['AI模型', 'NLP', '开源']
      },
      {
        name: 'Papers with Code',
        url: 'https://paperswithcode.com',
        description: 'AI论文与代码对应平台',
        tags: ['AI', '代码', 'benchmark']
      },
      {
        name: 'AlphaFold',
        url: 'https://alphafold.ebi.ac.uk',
        description: 'DeepMind蛋白质结构预测工具',
        tags: ['生物', 'AI', '蛋白质']
      },
      {
        name: 'Wolfram Alpha',
        url: 'https://www.wolframalpha.com',
        description: '计算知识引擎',
        tags: ['计算', '数学', '物理']
      },
      {
        name: 'MATLAB Online',
        url: 'https://www.mathworks.com/products/matlab-online.html',
        description: 'MATLAB在线版',
        tags: ['数值计算', '编程', '付费']
      },
      {
        name: 'SciPy',
        url: 'https://scipy.org',
        description: 'Python科学计算库',
        tags: ['Python', '开源', '科学计算']
      }
    ]
  },

  // 科研仪器与设备
  instruments: {
    title: '🔭 科研仪器与设备',
    icon: Beaker,
    color: 'cyan',
    resources: [
      {
        name: 'LabX',
        url: 'https://www.labx.com',
        description: '实验室设备交易平台',
        tags: ['仪器', '二手', '交易']
      },
      {
        name: 'BioCompare',
        url: 'https://www.biocompare.com',
        description: '生命科学仪器产品比较',
        tags: ['生物仪器', '产品对比', '评测']
      },
      {
        name: 'Thermo Fisher Scientific',
        url: 'https://www.thermofisher.com',
        description: '全球领先科学仪器公司',
        tags: ['仪器', '试剂', '综合']
      },
      {
        name: 'Agilent',
        url: 'https://www.agilent.com',
        description: '安捷伦科技仪器平台',
        tags: ['分析仪器', '化学', '生物']
      },
      {
        name: 'PerkinElmer',
        url: 'https://www.perkinelmer.com',
        description: '珀金埃尔默仪器',
        tags: ['分析', '生物', '环境']
      },
      {
        name: '国家大型科学仪器中心',
        url: 'https://www.nrc.ac.cn',
        description: '中国大型仪器共享平台',
        tags: ['仪器共享', '中国', '服务']
      }
    ]
  }
}

// 搜索功能
function filterResources(searchTerm: string): AcademicResourcesType {
  if (!searchTerm.trim()) return academicResources

  const filtered: AcademicResourcesType = {}
  Object.entries(academicResources).forEach(([key, category]) => {
    const matchedResources = category.resources.filter(resource => 
      resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    if (matchedResources.length > 0) {
      filtered[key] = {
        ...category,
        resources: matchedResources
      }
    }
  })
  return filtered
}

export default function AcademicNavigationPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filteredResources = filterResources(searchTerm)
  const categories = Object.entries(filteredResources)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Globe className="h-12 w-12 mr-3" />
              <h1 className="text-4xl font-bold">学术导航</h1>
            </div>
            <p className="text-xl opacity-90 mb-6">
              汇聚全球优质学术资源，助力科研工作者高效获取信息
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索学术资源、网站名称、标签..."
                  className="w-full pl-12 pr-4 py-4 text-gray-900 bg-white rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <Search className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 flex justify-center items-center space-x-8 text-sm">
              <div>
                <span className="font-bold text-2xl">{categories.length}</span>
                <span className="ml-2 opacity-90">个分类</span>
              </div>
              <div>
                <span className="font-bold text-2xl">
                  {Object.values(filteredResources).reduce((sum: number, cat: Category) => sum + cat.resources.length, 0)}
                </span>
                <span className="ml-2 opacity-90">个资源</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-white/70">
              (如需添加网站，请联系作者。)
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Sidebar - Category Navigation (Desktop) */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 px-2">分类导航</h3>
              <button
                onClick={() => setActiveCategory(null)}
                className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${
                  activeCategory === null
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <Globe className="h-5 w-5 mr-3 flex-shrink-0" />
                <span className="text-left text-sm break-words">全部分类</span>
              </button>
              {categories.map(([key, category]: [string, Category]) => {
                const Icon = category.icon
                return (
                  <button
                    key={key}
                    onClick={() => {
                      // If clicking the same category, toggle it off
                      if (activeCategory === key) {
                        setActiveCategory(null)
                      } else {
                        // Clear filter first to ensure all sections are rendered
                        setActiveCategory(null)
                        // Then scroll to the target section after a brief delay
                        setTimeout(() => {
                          const element = document.getElementById(key)
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                        }, 100)
                      }
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg transition-all ${
                      activeCategory === key
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span className="text-left text-sm break-words">{category.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mobile Category Navigation */}
          <div className="md:hidden w-full mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">分类导航</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-sm transition-all ${
                    activeCategory === null
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  <Globe className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="text-left break-words">全部分类</span>
                </button>
                {categories.map(([key, category]: [string, Category]) => {
                  const Icon = category.icon
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        // If clicking the same category, toggle it off
                        if (activeCategory === key) {
                          setActiveCategory(null)
                        } else {
                          // Clear filter first to ensure all sections are rendered
                          setActiveCategory(null)
                          // Then scroll to the target section after a brief delay
                          setTimeout(() => {
                            const element = document.getElementById(key)
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }
                          }, 100)
                        }
                      }}
                      className={`w-full flex items-center px-4 py-3 rounded-lg text-sm transition-all ${
                        activeCategory === key
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                      <span className="text-left break-words">{category.title}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Content - Resources */}
          <div className="flex-1 min-w-0 w-full lg:w-auto">
            {searchTerm && Object.keys(filteredResources).length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">未找到匹配的资源</p>
                <p className="text-gray-400 text-sm mt-2">请尝试其他关键词</p>
              </div>
            ) : (
              <div className="space-y-12">
            {categories.map(([key, category]: [string, Category]) => {
              if (activeCategory && activeCategory !== key) return null
              
              const Icon = category.icon
              const colorClasses = {
                blue: 'from-blue-500 to-blue-600',
                green: 'from-green-500 to-green-600',
                yellow: 'from-yellow-500 to-orange-500',
                purple: 'from-purple-500 to-purple-600',
                red: 'from-red-500 to-pink-500',
                indigo: 'from-indigo-500 to-indigo-600',
                pink: 'from-pink-500 to-rose-500',
                orange: 'from-orange-500 to-red-500',
                gray: 'from-gray-600 to-gray-700',
                teal: 'from-teal-500 to-cyan-500',
                cyan: 'from-cyan-500 to-blue-500'
              }
              
              return (
                <div key={key} id={key} className="scroll-mt-24">
                  <div className={`bg-gradient-to-r ${colorClasses[category.color as keyof typeof colorClasses]} text-white rounded-lg p-6 mb-6`}>
                    <div className="flex items-center">
                      <Icon className="h-8 w-8 mr-3" />
                      <h2 className="text-2xl font-bold">{category.title}</h2>
                      <span className="ml-auto bg-white/20 px-3 py-1 rounded-full text-sm">
                        {category.resources.length} 个资源
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {category.resources.map((resource: Resource, index: number) => (
                      <a
                        key={index}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 p-6 border border-gray-200 hover:border-blue-300 group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {resource.name}
                          </h3>
                          <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0 ml-2" />
                        </div>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {resource.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {resource.tags.map((tag: string, tagIndex: number) => (
                            <span
                              key={tagIndex}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Back to Top */}
      <div className="fixed bottom-8 right-8">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-300">
            研学港 - 学术导航 | 持续更新中，欢迎 <Link href="/" className="text-blue-400 hover:underline">反馈建议</Link>
          </p>
          <p className="text-gray-400 text-sm mt-2">
            资源收录不代表背书，请遵守各网站使用条款
          </p>
        </div>
      </div>
    </div>
  )
}

// Educational email validation utilities

// Common educational email domains
const EDUCATIONAL_DOMAINS = [
  // 中国大学域名
  'edu.cn',
  'ac.cn',
  
  // 国际教育域名
  'edu',
  'ac.uk',
  'edu.au',
  'ac.jp',
  'edu.sg',
  'ac.kr',
  'edu.tw',
  'edu.hk',
  'ac.nz',
  'edu.my',
  'ac.th',
  'edu.ph',
  'ac.in',
  'edu.pk',
  'ac.za',
  'edu.eg',
  'ac.il',
  'edu.tr',
  'ac.ir',
  'edu.sa',
  'ac.ae',
  'edu.jo',
  'ac.ma',
  'edu.tn',
  'ac.ke',
  'edu.ng',
  'ac.ug',
  'edu.gh',
  'ac.zm',
  'edu.zw',
  
  // 欧洲教育域名
  'ac.at',
  'edu.be',
  'ac.be',
  'edu.bg',
  'ac.bg',
  'edu.hr',
  'ac.cy',
  'edu.cz',
  'ac.dk',
  'edu.ee',
  'ac.fi',
  'edu.fr',
  'ac.fr',
  'edu.de',
  'ac.de',
  'edu.gr',
  'ac.gr',
  'edu.hu',
  'ac.hu',
  'edu.ie',
  'ac.ie',
  'edu.it',
  'ac.it',
  'edu.lv',
  'ac.lv',
  'edu.lt',
  'ac.lt',
  'edu.lu',
  'ac.lu',
  'edu.mt',
  'ac.mt',
  'edu.nl',
  'ac.nl',
  'edu.no',
  'ac.no',
  'edu.pl',
  'ac.pl',
  'edu.pt',
  'ac.pt',
  'edu.ro',
  'ac.ro',
  'edu.sk',
  'ac.sk',
  'edu.si',
  'ac.si',
  'edu.es',
  'ac.es',
  'edu.se',
  'ac.se',
  'edu.ch',
  'ac.ch',
  
  // 美洲教育域名
  'edu.ar',
  'ac.ar',
  'edu.br',
  'ac.br',
  'edu.ca',
  'ac.ca',
  'edu.cl',
  'ac.cl',
  'edu.co',
  'ac.co',
  'edu.mx',
  'ac.mx',
  'edu.pe',
  'ac.pe',
  'edu.uy',
  'ac.uy',
  'edu.ve',
  'ac.ve'
]

// Additional known educational institutions
const KNOWN_EDUCATIONAL_INSTITUTIONS = [
  // 中国知名大学
  'pku.edu.cn',
  'tsinghua.edu.cn',
  'fudan.edu.cn',
  'sjtu.edu.cn',
  'zju.edu.cn',
  'nju.edu.cn',
  'ustc.edu.cn',
  'hit.edu.cn',
  'bit.edu.cn',
  'buaa.edu.cn',
  'seu.edu.cn',
  'xjtu.edu.cn',
  'hust.edu.cn',
  'csu.edu.cn',
  'scu.edu.cn',
  'sysu.edu.cn',
  'mail.sysu.edu.cn',
  'stu.pku.edu.cn',
  'mails.tsinghua.edu.cn',
  
  // 国际知名大学
  'harvard.edu',
  'mit.edu',
  'stanford.edu',
  'berkeley.edu',
  'caltech.edu',
  'princeton.edu',
  'yale.edu',
  'columbia.edu',
  'uchicago.edu',
  'upenn.edu',
  'cornell.edu',
  'dartmouth.edu',
  'brown.edu',
  'duke.edu',
  'northwestern.edu',
  'jhu.edu',
  'rice.edu',
  'vanderbilt.edu',
  'wustl.edu',
  'emory.edu',
  'georgetown.edu',
  'cmu.edu',
  'usc.edu',
  'ucla.edu',
  'ucsd.edu',
  'ucsb.edu',
  'uci.edu',
  'ucr.edu',
  'ucsc.edu',
  'ucdavis.edu',
  'ox.ac.uk',
  'cam.ac.uk',
  'imperial.ac.uk',
  'ucl.ac.uk',
  'kcl.ac.uk',
  'lse.ac.uk',
  'ed.ac.uk',
  'manchester.ac.uk',
  'bristol.ac.uk',
  'warwick.ac.uk',
  'bath.ac.uk',
  'york.ac.uk',
  'exeter.ac.uk',
  'lancaster.ac.uk',
  'durham.ac.uk',
  'st-andrews.ac.uk',
  'u-tokyo.ac.jp',
  'kyoto-u.ac.jp',
  'osaka-u.ac.jp',
  'tohoku.ac.jp',
  'nagoya-u.ac.jp',
  'kyushu-u.ac.jp',
  'hokudai.ac.jp',
  'titech.ac.jp',
  'waseda.jp',
  'keio.jp'
]

/**
 * Check if an email address belongs to an educational institution
 */
export function isEducationalEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  const normalizedEmail = email.toLowerCase().trim()
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalizedEmail)) {
    return false
  }

  const domain = normalizedEmail.split('@')[1]
  
  // Check against known educational institutions
  if (KNOWN_EDUCATIONAL_INSTITUTIONS.includes(domain)) {
    return true
  }

  // Check against educational domain patterns
  return EDUCATIONAL_DOMAINS.some(eduDomain => {
    return domain === eduDomain || domain.endsWith('.' + eduDomain)
  })
}

/**
 * Get the institution name from email domain (best effort)
 */
export function getInstitutionFromEmail(email: string): string | null {
  if (!isEducationalEmail(email)) {
    return null
  }

  const domain = email.toLowerCase().split('@')[1]
  
  // Simple mapping for some known institutions
  const institutionMap: Record<string, string> = {
    'pku.edu.cn': '北京大学',
    'tsinghua.edu.cn': '清华大学',
    'fudan.edu.cn': '复旦大学',
    'sjtu.edu.cn': '上海交通大学',
    'zju.edu.cn': '浙江大学',
    'nju.edu.cn': '南京大学',
    'ustc.edu.cn': '中国科学技术大学',
    'harvard.edu': 'Harvard University',
    'mit.edu': 'Massachusetts Institute of Technology',
    'stanford.edu': 'Stanford University',
    'berkeley.edu': 'University of California, Berkeley',
    'ox.ac.uk': 'University of Oxford',
    'cam.ac.uk': 'University of Cambridge',
    'u-tokyo.ac.jp': 'University of Tokyo'
  }

  return institutionMap[domain] || null
}

/**
 * Validate email format and educational domain
 */
export function validateEducationalEmail(email: string): {
  isValid: boolean
  isEducational: boolean
  institution?: string
  error?: string
} {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      isEducational: false,
      error: '请输入邮箱地址'
    }
  }

  const normalizedEmail = email.toLowerCase().trim()
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalizedEmail)) {
    return {
      isValid: false,
      isEducational: false,
      error: '邮箱格式不正确'
    }
  }

  const isEducational = isEducationalEmail(normalizedEmail)
  
  if (!isEducational) {
    return {
      isValid: false,
      isEducational: false,
      error: '请使用教育邮箱注册（如：.edu.cn、.edu、.ac.uk等）'
    }
  }

  const institution = getInstitutionFromEmail(normalizedEmail)

  return {
    isValid: true,
    isEducational: true,
    institution: institution || undefined
  }
}

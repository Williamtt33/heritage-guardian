import PointCloudBackground from './PointCloudBackground'
import ScrollRoller from './ScrollRoller'

export default function About() {
  return (
    <main className="min-h-screen bg-surface-0 relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-ink-wash opacity-40" />
        <PointCloudBackground className="opacity-40" />
      </div>

      <div className="relative z-10" style={{ paddingTop: '90px' }}>
        {/* Header */}
        <section className="pt-20 sm:pt-28 pb-12 sm:pb-16">
          <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-10">
            <div className="mb-8 animate-fade-up">
              <ScrollRoller />
            </div>
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-medium tracking-[0.05em]"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(124,111,240,0.1)', color: '#7C6FF0' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-accent-1/60" />
                关于项目
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display tracking-tight mb-5 leading-[1.22]">
                <span className="gradient-text">关于晶格视界</span>
              </h1>
              <p className="text-text-3/60 text-sm max-w-lg mx-auto">
                历史文化街区数字化保护与活化利用平台
              </p>
            </div>
          </div>
        </section>

        {/* Content sections */}
        <section className="pb-24 sm:pb-32">
          <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-10 space-y-16 sm:space-y-20">

            {/* 1. 项目背景 */}
            <div className="animate-fade-up space-y-5">
              <h2 className="text-2xl sm:text-3xl font-display tracking-tight text-text-1">
                项目背景
              </h2>
              <div className="space-y-4 text-[14px] sm:text-[15px] text-text-2/80 leading-[1.85] font-light">
                <p>
                  中国拥有数量庞大的历史文化街区和不可移动文物，但在城镇化加速的今天，大量历史建筑面临自然老化、人为破坏和记录缺失的三重困境。传统的测绘建档方式成本高昂——激光扫描设备动辄数十万元，专业测绘团队覆盖面有限，许多区县级文保单位至今缺乏精确的三维档案。
                </p>
                <p>
                  三维高斯泼溅（3D Gaussian Splatting，简称 3DGS）是近年来计算机视觉领域的突破性技术。它只需普通相机拍摄的照片，就能在消费级 GPU 甚至浏览器中重建出毫米级精度的三维场景。这使得低成本、大规模、高保真的文化遗产数字化成为可能。
                </p>
                <p>
                  <strong>晶格视界</strong>正是基于 3DGS 技术构建的历史文化街区数字化保护平台。它不仅为历史建筑建立"数字双生"，更将建档、监测、共治、活化四大环节打通，为基层文化治理提供一站式数字化工具。
                </p>
              </div>
            </div>

            {/* 2. 四大核心能力 */}
            <div className="animate-fade-up space-y-5">
              <h2 className="text-2xl sm:text-3xl font-display tracking-tight text-text-1">
                核心能力
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: '🏛️', title: '数字建档', desc: '3DGS 高精度三维扫描，为每一处历史建筑建立包含结构信息、保护等级、文史档案的完整数字档案，永久保存建筑原貌。' },
                  { icon: '⏳', title: '时光对比', desc: '修缮前后同屏对比，历史照片与三维现状滑动切换，直观展示街区活化保护的真实成效，让改变看得见。' },
                  { icon: '🤝', title: '公众共治', desc: '居民与游客共同参与文化遗产保护——上报建筑隐患、分享历史记忆、提出保护建议，构建基层文化治理的数字化桥梁。' },
                  { icon: '🚩', title: '红色路线', desc: '以数字导览串联红色史迹，将党建教育融入历史文化空间的沉浸式体验，追寻革命足迹，传承红色基因。' },
                ].map(item => (
                  <div key={item.title} className="ink-card rounded-2xl p-5 sm:p-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.icon}</span>
                      <h3 className="text-[15px] font-semibold text-text-1">{item.title}</h3>
                    </div>
                    <p className="text-[13px] text-text-3/60 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 党建与基层治理 */}
            <div className="animate-fade-up space-y-5">
              <h2 className="text-2xl sm:text-3xl font-display tracking-tight text-text-1">
                党建与基层文化治理
              </h2>
              <div className="space-y-4 text-[14px] sm:text-[15px] text-text-2/80 leading-[1.85] font-light">
                <p>
                  历史文化街区的保护不仅是技术问题，更是基层治理课题。街区内建筑产权复杂、利益主体多元，保护工作需要党组织发挥统筹协调作用，也需要居民的广泛参与。
                </p>
                <ul className="space-y-3 list-none pl-0">
                  {[
                    { title: '红色路线数字化传承', desc: '将革命遗址、红色史迹以 3D 导览形式串联，为党员教育和群众性主题教育提供沉浸式学习体验。' },
                    { title: '公众参与共建共治', desc: '基层群众通过平台上报建筑隐患、提供历史线索，形成"党组织引领、专业人员研判、居民参与"的保护治理闭环。' },
                    { title: '数字化赋能基层决策', desc: '为街道和社区提供辖区文保建筑的可视化总览，辅助修缮优先级排序和资金分配决策。' },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{ background: 'rgba(198,40,40,0.1)', color: '#C62828' }}>{i + 1}</span>
                      <span><strong>{item.title}</strong>——{item.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 4. 技术架构 */}
            <div className="animate-fade-up space-y-5">
              <h2 className="text-2xl sm:text-3xl font-display tracking-tight text-text-1">
                技术架构
              </h2>
              <div className="space-y-3 text-[13px] sm:text-[14px] text-text-2/70 leading-relaxed font-light">
                <p>
                  平台采用纯前端渲染方案——3D 高斯泼溅数据在浏览器中通过 WebGL 实时渲染，无需后端 GPU 服务器，大幅降低部署和运维成本。
                </p>
                <div className="ink-card rounded-2xl p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  {[
                    { label: '前端框架', value: 'React 19' },
                    { label: '3D 引擎', value: 'gsplat.js' },
                    { label: '渲染技术', value: 'WebGL 2.0' },
                    { label: '后端服务', value: 'Supabase' },
                    { label: '样式方案', value: 'Tailwind CSS 4' },
                    { label: '构建工具', value: 'Vite 8' },
                    { label: '数据格式', value: '.splat / .ply' },
                    { label: '部署平台', value: 'GitHub Pages' },
                  ].map(t => (
                    <div key={t.label}>
                      <p className="text-[10px] text-text-3/40 mb-1">{t.label}</p>
                      <p className="text-[13px] font-medium text-text-1">{t.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-text-3/50 text-[12px]">
                  所有 3D 渲染在用户浏览器中完成，无需安装插件或客户端。支持桌面端与移动端访问。云端数据同步基于 Supabase 开源平台，支持本地化部署。
                </p>
              </div>
            </div>

            {/* 5. 未来展望 */}
            <div className="animate-fade-up space-y-5">
              <h2 className="text-2xl sm:text-3xl font-display tracking-tight text-text-1">
                未来展望
              </h2>
              <ul className="space-y-2 text-[14px] text-text-2/70">
                {[
                  '📱 移动端 App——让社区网格员可以随时随地拍摄上传、标注巡查',
                  '🔬 AI 变化检测——自动对比不同时期的 3D 扫描，识别建筑结构变化和安全隐患',
                  '🗺️ 更多街区接入——从岭南起步，逐步覆盖更多历史文化名城',
                  '📡 物联网集成——接入温湿度、倾斜等传感器，实现文物环境的实时监测预警',
                  '🌐 开放 API——为第三方开发者和研究机构提供数据接口，共建文保数字化生态',
                ].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

          </div>
        </section>

        {/* Bottom seal */}
        <div className="pb-16 animate-fade-in">
          <div className="max-w-4xl mx-auto px-6 mb-5">
            <ScrollRoller />
          </div>
          <div className="flex justify-center gap-4">
            <svg className="w-7 h-7 text-accent-1/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L3 12L12 22L21 12Z" />
              <path d="M12 2L12 22" />
              <path d="M3 12L21 12" />
            </svg>
            <span className="text-[10px] text-text-3/25 tracking-[0.2em] font-medium self-end"
              style={{ fontFamily: "'Noto Serif SC', serif" }}>
              党建领航 · 文化传承 · 科技赋能
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}

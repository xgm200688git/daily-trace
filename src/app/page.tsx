import {
  createLifeEntryAction,
  createWorkTaskAction,
  deleteEntryAction,
  generateCurrentWeekReportAction,
  saveTemplateAction,
  setDefaultTemplateAction,
  toggleAiAction,
  toggleWorkTaskStatusAction,
  updateLifeEntryAction,
  updateWorkTaskAction,
} from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { StatusBanner } from "@/components/status-banner";
import { TabNav } from "@/components/tab-nav";
import { getDashboardData } from "@/features/dashboard/service";
import { parseWeeklySections } from "@/features/reports/service";
import { reconcileOnAppOpen } from "@/features/reconcile/service";
import { parseTemplateDefinition } from "@/features/templates/service";
import { DEFAULT_TEMPLATE_DEFINITION, ENTRY_MODULE } from "@/lib/constants";
import { toJsonString } from "@/lib/json";
import {
  chineseDateLabel,
  formatLocalTime,
  toDateTimeLocalValue,
  weekEndFromStartKey,
} from "@/lib/time";
import { requireCurrentUserDbClient } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  tab?: string;
  message?: string;
  tone?: string;
}>;

function getTab(value?: string): "life" | "work" | "reports" {
  if (value === "work" || value === "reports") {
    return value;
  }

  return "life";
}

function getDailyRecordContent(
  records: Awaited<ReturnType<typeof getDashboardData>>["dailyRecords"],
  module: "life" | "work",
) {
  return records.find((record) => record.module === module);
}

function ReportSectionList({
  sections,
}: {
  sections: Record<string, string[] | string>;
}) {
  return (
    <div className="space-y-4">
      {Object.entries(sections).map(([key, value]) => (
        <div key={key} className="space-y-2">
          <h4 className="text-sm font-semibold text-stone-900">{key}</h4>
          {Array.isArray(value) ? (
            <ul className="space-y-1 text-sm text-stone-600">
              {value.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-7 text-stone-600">{value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const currentTab = getTab(resolvedSearchParams.tab);
  let reconcileMessage: string | undefined;
  const client = await requireCurrentUserDbClient();

  try {
    await reconcileOnAppOpen(client);
  } catch {
    reconcileMessage = "应用启动补偿失败，当前展示的可能不是最新合并结果。";
  }

  const data = await getDashboardData(client);
  const lifeRecord = getDailyRecordContent(data.dailyRecords, ENTRY_MODULE.LIFE);
  const workRecord = getDailyRecordContent(data.dailyRecords, ENTRY_MODULE.WORK);
  const currentWeekEnd = weekEndFromStartKey(data.currentWeekStart);
  const currentWeeklySections = data.currentWeeklyReport
    ? parseWeeklySections(data.currentWeeklyReport.sectionsJson)
    : {};

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-28 pt-6 md:px-8 md:pb-12">
      <header className="grid gap-6 rounded-[2rem] border border-black/6 bg-white/82 px-6 py-6 shadow-[0_24px_80px_rgba(31,20,10,0.06)] backdrop-blur md:grid-cols-[1.4fr_1fr] md:px-8">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-400">
            {chineseDateLabel(data.today)}
          </p>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-stone-950 md:text-5xl">
              每日轨迹
            </h1>
            <p className="max-w-2xl text-base leading-7 text-stone-600">
              把生活碎片、工作任务和每周复盘都放进一个安静的工作台里。你只负责记录，
              应用负责在后台把它们整理成日报和周报。
            </p>
          </div>
        </div>
        <div className="grid gap-3 rounded-[1.6rem] border border-black/5 bg-stone-950 px-5 py-5 text-stone-100">
          <div className="flex items-center justify-between text-sm text-stone-300">
            <span>当前时区</span>
            <span className="font-mono text-xs">{data.profile.timezone}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-stone-300">
            <span>今日生活记录</span>
            <span>{data.lifeEntries.length} 条</span>
          </div>
          <div className="flex items-center justify-between text-sm text-stone-300">
            <span>未完成任务</span>
            <span>{data.pendingWorkTasks.length} 项</span>
          </div>
          <div className="flex items-center justify-between text-sm text-stone-300">
            <span>默认模板</span>
            <span>{data.templates.find((item) => item.isDefault)?.name ?? "未设置"}</span>
          </div>
        </div>
      </header>

      <main className="mt-6 grid flex-1 gap-6">
        <StatusBanner
          message={resolvedSearchParams.message || reconcileMessage}
          tone={resolvedSearchParams.tone}
        />

        {currentTab === "life" && (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4 rounded-[2rem] border border-black/6 bg-white/86 px-6 py-6 shadow-[0_18px_60px_rgba(31,20,10,0.05)]">
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-400">生活</p>
                <h2 className="text-2xl font-semibold text-stone-950">
                  今天发生了什么？
                </h2>
              </div>
              <form action={createLifeEntryAction} className="grid gap-3">
                <textarea
                  name="content"
                  rows={5}
                  required
                  placeholder="写下今天的片段、情绪或一句话。"
                  className="w-full rounded-[1.5rem] border border-black/8 bg-stone-50 px-4 py-4 text-base text-stone-900 outline-none transition focus:border-stone-300"
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    name="mood"
                    placeholder="心情，例如：平静 / 开心"
                    className="rounded-full border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                  />
                  <input
                    name="tags"
                    placeholder="标签，逗号分隔"
                    className="rounded-full border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                  />
                  <input
                    name="occurredAt"
                    type="datetime-local"
                    className="rounded-full border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                  />
                </div>
                <button className="inline-flex w-fit items-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800">
                  保存生活记录
                </button>
              </form>
            </div>

            <div className="space-y-4 rounded-[2rem] border border-black/6 bg-white/70 px-6 py-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-stone-400">今日时间线</p>
                <h3 className="text-xl font-semibold text-stone-950">
                  已记录 {data.lifeEntries.length} 条
                </h3>
              </div>
              <div className="space-y-4">
                {data.lifeEntries.length ? (
                  data.lifeEntries.map((entry) => (
                    <article
                      key={entry.id}
                      className="space-y-3 border-b border-black/5 pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
                              {formatLocalTime(new Date(entry.occurredAt), data.profile.timezone)}
                          </p>
                          <p className="leading-7 text-stone-800">{entry.content}</p>
                          {(entry.mood || entry.tags.length) && (
                            <p className="text-xs text-stone-500">
                              {entry.mood ? `心情：${entry.mood}` : ""}
                              {entry.mood && entry.tags.length ? " · " : ""}
                              {entry.tags.length ? `标签：${entry.tags.join(" / ")}` : ""}
                            </p>
                          )}
                        </div>
                        <form action={deleteEntryAction}>
                          <input type="hidden" name="entryId" value={entry.id} />
                          <input type="hidden" name="tab" value="life" />
                          <button className="text-xs font-medium text-stone-400 transition hover:text-rose-600">
                            删除
                          </button>
                        </form>
                      </div>
                      <details className="rounded-2xl bg-stone-50 px-4 py-3">
                        <summary className="cursor-pointer text-sm font-medium text-stone-600">
                          编辑这条记录
                        </summary>
                        <form action={updateLifeEntryAction} className="mt-3 grid gap-3">
                          <input type="hidden" name="entryId" value={entry.id} />
                          <textarea
                            name="content"
                            rows={4}
                            defaultValue={entry.content}
                            className="w-full rounded-2xl border border-black/8 bg-white px-4 py-4 text-sm outline-none transition focus:border-stone-300"
                          />
                          <div className="grid gap-3 md:grid-cols-3">
                            <input
                              name="mood"
                              defaultValue={entry.mood ?? ""}
                              className="rounded-full border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                            />
                            <input
                              name="tags"
                              defaultValue={entry.tags.join(", ")}
                              className="rounded-full border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                            />
                            <input
                              name="occurredAt"
                              type="datetime-local"
                              defaultValue={toDateTimeLocalValue(
                                entry.occurredAt,
                                data.profile.timezone,
                              )}
                              className="rounded-full border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                            />
                          </div>
                          <button className="inline-flex w-fit items-center rounded-full border border-black/8 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-black/20 hover:text-black">
                            保存修改
                          </button>
                        </form>
                      </details>
                    </article>
                  ))
                ) : (
                  <p className="text-sm leading-7 text-stone-500">
                    还没有生活记录。先从一句话开始，应用会自动按时间整理成生活日报。
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {currentTab === "work" && (
          <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4 rounded-[2rem] border border-black/6 bg-white/86 px-6 py-6 shadow-[0_18px_60px_rgba(31,20,10,0.05)]">
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-400">工作</p>
                <h2 className="text-2xl font-semibold text-stone-950">新建任务</h2>
              </div>
              <form action={createWorkTaskAction} className="grid gap-3">
                <input
                  name="title"
                  required
                  placeholder="任务标题"
                  className="rounded-full border border-black/8 bg-stone-50 px-4 py-3 text-base outline-none transition focus:border-stone-300"
                />
                <textarea
                  name="description"
                  rows={4}
                  placeholder="补充任务描述、会议纪要或进展背景。"
                  className="w-full rounded-[1.5rem] border border-black/8 bg-stone-50 px-4 py-4 text-base text-stone-900 outline-none transition focus:border-stone-300"
                />
                <button className="inline-flex w-fit items-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800">
                  创建任务
                </button>
              </form>
            </div>

            <div className="grid gap-5">
              <section className="rounded-[2rem] border border-black/6 bg-white/72 px-6 py-6">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-400">待处理</p>
                    <h3 className="text-xl font-semibold text-stone-950">
                      {data.pendingWorkTasks.length} 项进行中
                    </h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {data.pendingWorkTasks.length ? (
                    data.pendingWorkTasks.map((task) => (
                      <article key={task.id} className="rounded-[1.6rem] border border-black/6 bg-stone-50 px-4 py-4">
                        <form action={toggleWorkTaskStatusAction}>
                          <input type="hidden" name="entryId" value={task.id} />
                          <button className="flex w-full items-start gap-3 text-left">
                            <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-400 text-[10px] text-stone-400">
                              ○
                            </span>
                            <span className="space-y-1">
                              <span className="block text-base font-medium text-stone-900">
                                {task.title}
                              </span>
                              {task.content ? (
                                <span className="block text-sm leading-6 text-stone-600">
                                  {task.content}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </form>
                        <details className="mt-3 rounded-2xl bg-white px-4 py-3">
                          <summary className="cursor-pointer text-sm font-medium text-stone-600">
                            编辑任务
                          </summary>
                          <form action={updateWorkTaskAction} className="mt-3 grid gap-3">
                            <input type="hidden" name="entryId" value={task.id} />
                            <input
                              name="title"
                              defaultValue={task.title ?? ""}
                              className="rounded-full border border-black/8 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                            />
                            <textarea
                              name="description"
                              rows={3}
                              defaultValue={task.content}
                              className="rounded-2xl border border-black/8 bg-stone-50 px-4 py-4 text-sm outline-none transition focus:border-stone-300"
                            />
                            <button className="inline-flex w-fit items-center rounded-full border border-black/8 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-black/20 hover:text-black">
                              保存修改
                            </button>
                          </form>
                        </details>
                        <form action={deleteEntryAction} className="mt-3">
                          <input type="hidden" name="entryId" value={task.id} />
                          <input type="hidden" name="tab" value="work" />
                          <button className="text-xs font-medium text-stone-400 transition hover:text-rose-600">
                            删除
                          </button>
                        </form>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm leading-7 text-stone-500">
                      当前没有待处理任务，试着新建一项，或把右侧已完成任务继续拆分成新的动作。
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-black/6 bg-white/72 px-6 py-6">
                <div className="mb-4">
                  <p className="text-sm font-medium text-stone-400">已完成</p>
                  <h3 className="text-xl font-semibold text-stone-950">
                    {data.completedWorkTasks.length} 项已完成
                  </h3>
                </div>
                <div className="space-y-3">
                  {data.completedWorkTasks.length ? (
                    data.completedWorkTasks.map((task) => (
                      <article key={task.id} className="rounded-[1.5rem] border border-black/6 bg-stone-50 px-4 py-4">
                        <form action={toggleWorkTaskStatusAction}>
                          <input type="hidden" name="entryId" value={task.id} />
                          <button className="flex w-full items-start gap-3 text-left">
                            <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[10px] text-stone-50">
                              ✓
                            </span>
                            <span className="space-y-1">
                              <span className="block text-base font-medium text-stone-500 line-through">
                                {task.title}
                              </span>
                              {task.content ? (
                                <span className="block text-sm leading-6 text-stone-500">
                                  {task.content}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </form>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm leading-7 text-stone-500">
                      还没有已完成的任务。点开上面的任务行即可快速标记完成。
                    </p>
                  )}
                </div>
              </section>
            </div>
          </section>
        )}

        {currentTab === "reports" && (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-black/6 bg-white/86 px-6 py-6 shadow-[0_18px_60px_rgba(31,20,10,0.05)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-stone-400">今日合并结果</p>
                    <h2 className="text-2xl font-semibold text-stone-950">日报预览</h2>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <article className="rounded-[1.6rem] border border-black/6 bg-stone-50 px-4 py-4">
                    <p className="mb-3 text-sm font-medium text-stone-400">生活日报</p>
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
                      {lifeRecord?.contentMarkdown ?? "今天还没有生活日报内容。"}
                    </pre>
                  </article>
                  <article className="rounded-[1.6rem] border border-black/6 bg-stone-50 px-4 py-4">
                    <p className="mb-3 text-sm font-medium text-stone-400">工作日报</p>
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
                      {workRecord?.contentMarkdown ?? "今天还没有工作日报内容。"}
                    </pre>
                  </article>
                </div>
              </div>

              <div className="rounded-[2rem] border border-black/6 bg-white/86 px-6 py-6 shadow-[0_18px_60px_rgba(31,20,10,0.05)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-stone-400">本周周报</p>
                    <h2 className="text-2xl font-semibold text-stone-950">
                      {chineseDateLabel(data.currentWeekStart)} - {chineseDateLabel(currentWeekEnd)}
                    </h2>
                  </div>
                  {data.currentWeeklyReport ? (
                    <CopyButton value={data.currentWeeklyReport.contentMarkdown} />
                  ) : null}
                </div>
                <form action={generateCurrentWeekReportAction} className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
                  <input type="hidden" name="weekStart" value={data.currentWeekStart} />
                  <select
                    name="templateId"
                    defaultValue={data.templates.find((item) => item.isDefault)?.id}
                    className="rounded-full border border-black/8 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                  >
                    {data.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.isDefault ? "（默认）" : ""}
                      </option>
                    ))}
                  </select>
                  <button className="inline-flex w-fit items-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800">
                    一键生成本周周报
                  </button>
                </form>

                <div className="mt-6 space-y-4">
                  {data.currentWeeklyReport ? (
                    <>
                      <pre className="whitespace-pre-wrap rounded-[1.6rem] border border-black/6 bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-700">
                        {data.currentWeeklyReport.contentMarkdown}
                      </pre>
                      <ReportSectionList sections={currentWeeklySections} />
                    </>
                  ) : (
                    <p className="rounded-[1.5rem] border border-dashed border-black/10 bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-500">
                      本周周报还没有生成。完成几项工作任务后，点上面的按钮就可以用默认模板快速产出。
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-black/6 bg-white/72 px-6 py-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-stone-400">生成设置</p>
                  <h3 className="text-xl font-semibold text-stone-950">模板与 AI</h3>
                </div>
                <form action={toggleAiAction} className="mt-4 flex items-center justify-between rounded-[1.4rem] border border-black/6 bg-stone-50 px-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-stone-900">启用 AI 增强</p>
                    <p className="text-xs leading-6 text-stone-500">
                      没有配置 OPENAI_API_KEY 时会自动降级为规则生成。
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      name="aiEnabled"
                      defaultChecked={data.profile.aiEnabled}
                      className="h-4 w-4 rounded border-stone-300"
                    />
                    启用
                  </label>
                  <button className="rounded-full border border-black/8 px-4 py-2 text-xs font-medium text-stone-700 transition hover:border-black/20 hover:text-black">
                    保存
                  </button>
                </form>

                <form action={setDefaultTemplateAction} className="mt-4 grid gap-3">
                  <select
                    name="templateId"
                    defaultValue={data.templates.find((item) => item.isDefault)?.id}
                    className="rounded-full border border-black/8 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                  >
                    {data.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.isDefault ? "（默认）" : ""}
                      </option>
                    ))}
                  </select>
                  <button className="inline-flex w-fit items-center rounded-full border border-black/8 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-black/20 hover:text-black">
                    设为默认模板
                  </button>
                </form>

                <details className="mt-5 rounded-[1.6rem] bg-stone-50 px-4 py-4">
                  <summary className="cursor-pointer text-sm font-medium text-stone-700">
                    新建 / 导入自定义模板
                  </summary>
                  <form action={saveTemplateAction} className="mt-4 grid gap-3">
                    <input
                      name="name"
                      placeholder="模板名称"
                      className="rounded-full border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-300"
                    />
                    <textarea
                      name="definitionJson"
                      rows={16}
                      defaultValue={toJsonString(DEFAULT_TEMPLATE_DEFINITION)}
                      className="rounded-[1.5rem] border border-black/8 bg-white px-4 py-4 text-sm font-mono leading-6 outline-none transition focus:border-stone-300"
                    />
                    <button className="inline-flex w-fit items-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800">
                      保存模板
                    </button>
                  </form>
                </details>
              </div>

              <div className="rounded-[2rem] border border-black/6 bg-white/72 px-6 py-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-stone-400">历史周报</p>
                  <h3 className="text-xl font-semibold text-stone-950">最近 6 个版本</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {data.weeklyHistory.length ? (
                    data.weeklyHistory.map((report) => {
                      const template = report.template
                        ? parseTemplateDefinition(report.template.definitionJson)
                        : null;

                      return (
                        <article
                          key={report.id}
                          className="rounded-[1.5rem] border border-black/6 bg-stone-50 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-stone-900">
                                {chineseDateLabel(report.weekStart)} - {chineseDateLabel(report.weekEnd)}
                              </p>
                              <p className="mt-1 text-xs leading-6 text-stone-500">
                                Revision {report.revision}
                                {report.isCurrent ? " · 当前版本" : ""}
                                {template ? ` · ${template.name}` : ""}
                              </p>
                            </div>
                            <CopyButton value={report.contentMarkdown} />
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="text-sm leading-7 text-stone-500">
                      还没有历史周报。首次生成后，这里会自动保留最近版本供你回看和复制。
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <TabNav currentTab={currentTab} />
    </div>
  );
}

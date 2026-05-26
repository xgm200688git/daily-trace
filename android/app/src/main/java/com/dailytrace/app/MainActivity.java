package com.dailytrace.app;

import android.app.Activity;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.database.sqlite.SQLiteException;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final String TAG = "DailyTrace";
    private static final String TAB_LIFE = "life";
    private static final String TAB_WORK = "work";
    private static final String TAB_REPORTS = "reports";

    private final SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.CHINA);
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.CHINA);
    private final SimpleDateFormat labelFormat = new SimpleDateFormat("M月d日", Locale.CHINA);

    private DiaryDb helper;
    private LinearLayout root;
    private String currentTab = TAB_LIFE;
    private String statusMessage;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        helper = new DiaryDb(this);
        generateDailyRecord(todayKey(), "life");
        generateDailyRecord(todayKey(), "work");
        render();
    }

    private void render() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(20), dp(16), dp(14));
        root.setBackgroundColor(Color.parseColor("#F7F4EE"));

        addHeader(root);
        addTabs(root);

        if (statusMessage != null) {
            TextView status = text(statusMessage, 14, "#14532D", Typeface.BOLD);
            status.setPadding(dp(14), dp(10), dp(14), dp(10));
            status.setBackground(cardBackground("#ECFDF5", "#BBF7D0", 16));
            root.addView(status, matchWrap());
        }

        ScrollView scrollView = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(0, dp(12), 0, dp(24));
        scrollView.addView(content);
        root.addView(scrollView, new LinearLayout.LayoutParams(-1, 0, 1));

        if (TAB_LIFE.equals(currentTab)) {
            renderLife(content);
        } else if (TAB_WORK.equals(currentTab)) {
            renderWork(content);
        } else {
            renderReports(content);
        }

        setContentView(root);
    }

    private void performAction(String successMessage, View keyboardAnchor, DiaryAction action) {
        try {
            action.run();
            if (keyboardAnchor != null) {
                hideKeyboard(keyboardAnchor);
            }
            setStatus(successMessage);
        } catch (Exception error) {
            Log.e(TAG, "Diary action failed", error);
            setStatus("操作失败：" + userFacingError(error));
        }
    }

    private String userFacingError(Exception error) {
        String message = error.getMessage();
        if (notBlank(message)) {
            return message;
        }
        return "请关闭应用后重新打开再试。";
    }

    private void addHeader(LinearLayout parent) {
        TextView date = text(dateLabel(todayKey()), 13, "#78716C", Typeface.BOLD);
        parent.addView(date);

        TextView title = text("每日轨迹", 30, "#181411", Typeface.BOLD);
        title.setPadding(0, dp(4), 0, dp(4));
        parent.addView(title);

        TextView subtitle = text("离线原生 Android 版，本地保存生活记录、工作任务、日报和周报。", 14, "#625A51", Typeface.NORMAL);
        subtitle.setPadding(0, 0, 0, dp(12));
        parent.addView(subtitle);
    }

    private void addTabs(LinearLayout parent) {
        LinearLayout tabs = new LinearLayout(this);
        tabs.setOrientation(LinearLayout.HORIZONTAL);
        tabs.setGravity(Gravity.CENTER);
        tabs.setPadding(0, dp(4), 0, dp(8));

        addTab(tabs, "生活", TAB_LIFE);
        addTab(tabs, "工作", TAB_WORK);
        addTab(tabs, "报告", TAB_REPORTS);
        parent.addView(tabs, matchWrap());
    }

    private void addTab(LinearLayout tabs, String label, final String key) {
        Button button = new Button(this);
        button.setText(label);
        styleButton(button, key.equals(currentTab));
        button.setOnClickListener(v -> {
            currentTab = key;
            statusMessage = null;
            render();
        });
        tabs.addView(button, new LinearLayout.LayoutParams(0, dp(44), 1));
    }

    private void renderLife(LinearLayout parent) {
        LinearLayout form = card();
        form.addView(text("今天发生了什么？", 21, "#181411", Typeface.BOLD));

        EditText content = input("生活内容", 4);
        EditText mood = input("心情，例如：平静 / 开心", 1);
        EditText tags = input("标签，逗号分隔", 1);
        form.addView(content);
        form.addView(mood);
        form.addView(tags);

        Button save = primaryButton("保存生活记录");
        save.setOnClickListener(v -> {
            String value = content.getText().toString().trim();
            if (value.isEmpty()) {
                setStatus("生活记录不能为空。");
                return;
            }

            performAction("生活记录已保存。", content, () -> {
                addLifeEntry(value, mood.getText().toString().trim(), tags.getText().toString().trim());
                generateDailyRecord(todayKey(), "life");
            });
        });
        form.addView(save);
        parent.addView(form);

        parent.addView(sectionTitle("今日时间线"));

        SQLiteDatabase db = helper.getReadableDatabase();
        try (Cursor cursor = db.rawQuery(
                "SELECT id, occurred_at, content, mood, tags FROM entries WHERE module='life' AND local_date=? AND deleted_at IS NULL ORDER BY occurred_at DESC",
                new String[]{todayKey()})) {
            if (!cursor.moveToFirst()) {
                parent.addView(emptyText("还没有生活记录。先写一句话，本地数据库会立即保存。"));
                return;
            }

            do {
                LinearLayout item = card();
                String id = cursor.getString(0);
                long occurredAt = cursor.getLong(1);
                String body = safeText(cursor.getString(2));
                String moodValue = cursor.getString(3);
                String tagValue = cursor.getString(4);

                item.addView(text(timeFormat.format(new Date(occurredAt)), 12, "#78716C", Typeface.BOLD));
                item.addView(text(body, 16, "#292524", Typeface.NORMAL));
                if (notBlank(moodValue) || notBlank(tagValue)) {
                    item.addView(text(metaLine(moodValue, tagValue), 12, "#78716C", Typeface.NORMAL));
                }

                Button delete = outlineButton("删除");
                delete.setOnClickListener(v -> {
                    performAction("生活记录已删除。", null, () -> {
                        softDelete(id);
                        generateDailyRecord(todayKey(), "life");
                    });
                });
                item.addView(delete);
                parent.addView(item);
            } while (cursor.moveToNext());
        }
    }

    private void renderWork(LinearLayout parent) {
        LinearLayout form = card();
        form.addView(text("新建工作任务", 21, "#181411", Typeface.BOLD));

        EditText title = input("任务标题", 1);
        EditText description = input("任务描述", 3);
        form.addView(title);
        form.addView(description);

        Button create = primaryButton("创建任务");
        create.setOnClickListener(v -> {
            String value = title.getText().toString().trim();
            if (value.isEmpty()) {
                setStatus("任务标题不能为空。");
                return;
            }

            performAction("工作任务已创建。", title, () -> addWorkTask(value, description.getText().toString().trim()));
        });
        form.addView(create);
        parent.addView(form);

        parent.addView(sectionTitle("待处理"));
        renderTaskList(parent, "pending");

        parent.addView(sectionTitle("已完成"));
        renderTaskList(parent, "completed");
    }

    private void renderTaskList(LinearLayout parent, String status) {
        SQLiteDatabase db = helper.getReadableDatabase();
        String order = "completed".equals(status) ? "completed_at DESC" : "created_at DESC";
        try (Cursor cursor = db.rawQuery(
                "SELECT id, title, content, completed_local_date FROM entries WHERE module='work' AND task_status=? AND deleted_at IS NULL ORDER BY " + order,
                new String[]{status})) {
            if (!cursor.moveToFirst()) {
                parent.addView(emptyText("completed".equals(status) ? "还没有已完成任务。" : "当前没有待处理任务。"));
                return;
            }

            do {
                LinearLayout item = card();
                String id = cursor.getString(0);
                String title = safeText(cursor.getString(1));
                String content = safeText(cursor.getString(2));
                String completedDate = cursor.getString(3);

                item.addView(text(title, 16, "#292524", Typeface.BOLD));
                if (notBlank(content)) {
                    item.addView(text(content, 14, "#625A51", Typeface.NORMAL));
                }

                LinearLayout actions = new LinearLayout(this);
                actions.setOrientation(LinearLayout.HORIZONTAL);

                Button toggle = outlineButton("completed".equals(status) ? "撤回" : "标记完成");
                toggle.setOnClickListener(v -> {
                    if ("completed".equals(status)) {
                        performAction("任务已撤回待处理。", null, () -> reopenTask(id, completedDate));
                    } else {
                        performAction("任务已标记完成。", null, () -> completeTask(id));
                    }
                });
                actions.addView(toggle, new LinearLayout.LayoutParams(0, dp(44), 1));

                Button delete = outlineButton("删除");
                delete.setOnClickListener(v -> {
                    performAction("任务已删除。", null, () -> {
                        softDelete(id);
                        if (notBlank(completedDate)) {
                            generateDailyRecord(completedDate, "work");
                            generateWeeklyReport(weekStart(completedDate));
                        }
                    });
                });
                actions.addView(delete, new LinearLayout.LayoutParams(0, dp(44), 1));
                item.addView(actions);

                parent.addView(item);
            } while (cursor.moveToNext());
        }
    }

    private void renderReports(LinearLayout parent) {
        LinearLayout actions = card();
        actions.addView(text("日报与周报", 21, "#181411", Typeface.BOLD));

        Button mergeToday = primaryButton("刷新今日日报");
        mergeToday.setOnClickListener(v -> {
            performAction("今日日报已刷新。", null, () -> {
                generateDailyRecord(todayKey(), "life");
                generateDailyRecord(todayKey(), "work");
            });
        });
        actions.addView(mergeToday);

        Button weekly = primaryButton("生成本周周报");
        weekly.setOnClickListener(v -> {
            performAction("本周周报已生成。", null, () -> generateWeeklyReport(currentWeekStart()));
        });
        actions.addView(weekly);
        parent.addView(actions);

        parent.addView(sectionTitle("生活日报"));
        parent.addView(markdownCard(getDailyRecord(todayKey(), "life", "今天还没有生活日报内容。")));

        parent.addView(sectionTitle("工作日报"));
        parent.addView(markdownCard(getDailyRecord(todayKey(), "work", "今天还没有工作日报内容。")));

        parent.addView(sectionTitle("本周周报"));
        parent.addView(markdownCard(getCurrentWeeklyReport(currentWeekStart())));
    }

    private void addLifeEntry(String content, String mood, String tags) {
        long now = System.currentTimeMillis();
        ContentValues values = baseEntry("life", now);
        values.put("content", content);
        values.put("mood", emptyToNull(mood));
        values.put("tags", emptyToNull(tags));
        helper.getWritableDatabase().insertOrThrow("entries", null, values);
    }

    private void addWorkTask(String title, String description) {
        long now = System.currentTimeMillis();
        ContentValues values = baseEntry("work", now);
        values.put("title", title);
        values.put("content", description);
        values.put("task_status", "pending");
        helper.getWritableDatabase().insertOrThrow("entries", null, values);
    }

    private ContentValues baseEntry(String module, long now) {
        ContentValues values = new ContentValues();
        values.put("id", UUID.randomUUID().toString());
        values.put("module", module);
        values.put("occurred_at", now);
        values.put("local_date", dateKey(now));
        values.put("created_at", now);
        values.put("updated_at", now);
        return values;
    }

    private void completeTask(String id) {
        long now = System.currentTimeMillis();
        ContentValues values = new ContentValues();
        values.put("task_status", "completed");
        values.put("completed_at", now);
        values.put("completed_local_date", dateKey(now));
        values.put("updated_at", now);
        requireUpdated(helper.getWritableDatabase().update("entries", values, "id=?", new String[]{id}), "没有找到要完成的任务。");
        generateDailyRecord(dateKey(now), "work");
        generateWeeklyReport(currentWeekStart());
    }

    private void reopenTask(String id, String completedDate) {
        ContentValues values = new ContentValues();
        values.put("task_status", "pending");
        values.putNull("completed_at");
        values.putNull("completed_local_date");
        values.put("updated_at", System.currentTimeMillis());
        requireUpdated(helper.getWritableDatabase().update("entries", values, "id=?", new String[]{id}), "没有找到要撤回的任务。");
        if (notBlank(completedDate)) {
            generateDailyRecord(completedDate, "work");
            generateWeeklyReport(weekStart(completedDate));
        }
    }

    private void softDelete(String id) {
        ContentValues values = new ContentValues();
        long now = System.currentTimeMillis();
        values.put("deleted_at", now);
        values.put("updated_at", now);
        requireUpdated(helper.getWritableDatabase().update("entries", values, "id=?", new String[]{id}), "没有找到要删除的记录。");
    }

    private void requireUpdated(int updated, String message) {
        if (updated <= 0) {
            throw new IllegalStateException(message);
        }
    }

    private void generateDailyRecord(String dateKey, String module) {
        String markdown = "life".equals(module) ? buildLifeDaily(dateKey) : buildWorkDaily(dateKey);
        ContentValues values = new ContentValues();
        values.put("id", UUID.randomUUID().toString());
        values.put("module", module);
        values.put("record_date", dateKey);
        values.put("content_markdown", markdown);
        values.put("updated_at", System.currentTimeMillis());

        SQLiteDatabase db = helper.getWritableDatabase();
        int updated = db.update("daily_records", values, "module=? AND record_date=?", new String[]{module, dateKey});
        if (updated == 0) {
            db.insertOrThrow("daily_records", null, values);
        }
    }

    private String buildLifeDaily(String dateKey) {
        StringBuilder builder = new StringBuilder();
        builder.append("# 生活日报 · ").append(dateLabel(dateKey)).append("\n\n");
        SQLiteDatabase db = helper.getReadableDatabase();
        try (Cursor cursor = db.rawQuery(
                "SELECT occurred_at, content, mood, tags FROM entries WHERE module='life' AND local_date=? AND deleted_at IS NULL ORDER BY occurred_at ASC",
                new String[]{dateKey})) {
            if (!cursor.moveToFirst()) {
                builder.append("- 今天还没有生活记录。");
                return builder.toString();
            }

            do {
                String meta = metaLine(cursor.getString(2), cursor.getString(3));
                builder
                        .append("- ")
                        .append(timeFormat.format(new Date(cursor.getLong(0))))
                        .append(" ")
                        .append(safeText(cursor.getString(1)));
                if (notBlank(meta)) {
                    builder.append("（").append(meta).append("）");
                }
                builder.append("\n");
            } while (cursor.moveToNext());
        }
        return builder.toString().trim();
    }

    private String buildWorkDaily(String dateKey) {
        StringBuilder builder = new StringBuilder();
        builder.append("# 工作日报 · ").append(dateLabel(dateKey)).append("\n\n");
        SQLiteDatabase db = helper.getReadableDatabase();
        try (Cursor cursor = db.rawQuery(
                "SELECT completed_at, title, content FROM entries WHERE module='work' AND task_status='completed' AND completed_local_date=? AND deleted_at IS NULL ORDER BY completed_at ASC",
                new String[]{dateKey})) {
            if (!cursor.moveToFirst()) {
                builder.append("- 今天没有已完成的工作任务。");
                return builder.toString();
            }

            do {
                String title = safeText(cursor.getString(1));
                String description = safeText(cursor.getString(2));
                builder
                        .append("- ")
                        .append(timeFormat.format(new Date(cursor.getLong(0))))
                        .append(" ")
                        .append(title);
                if (notBlank(description)) {
                    builder.append("：").append(description);
                }
                builder.append("\n");
            } while (cursor.moveToNext());
        }
        return builder.toString().trim();
    }

    private void generateWeeklyReport(String weekStart) {
        String weekEnd = addDays(weekStart, 6);
        StringBuilder completed = new StringBuilder();
        StringBuilder issues = new StringBuilder();
        int count = 0;

        SQLiteDatabase db = helper.getReadableDatabase();
        try (Cursor cursor = db.rawQuery(
                "SELECT title, content FROM entries WHERE module='work' AND task_status='completed' AND completed_local_date>=? AND completed_local_date<=? AND deleted_at IS NULL ORDER BY completed_at ASC",
                new String[]{weekStart, weekEnd})) {
            while (cursor.moveToNext()) {
                count += 1;
                String title = safeText(cursor.getString(0));
                String description = safeText(cursor.getString(1));
                String line = title + (notBlank(description) ? "：" + description : "");
                completed.append("- ").append(line).append("\n");
                if (line.contains("阻塞") || line.contains("风险") || line.contains("问题") || line.contains("延期")) {
                    issues.append("- ").append(line).append("\n");
                }
            }
        }

        String markdown = "# 周报 · " + dateLabel(weekStart) + " - " + dateLabel(weekEnd) + "\n\n"
                + "## 已完成工作\n" + (count == 0 ? "- 本周暂无完成项。\n" : completed.toString())
                + "\n## 成果亮点\n" + (count == 0 ? "- 本周以记录和维护为主。\n" : "- 本周完成 " + count + " 项工作。\n")
                + "\n## 问题阻塞\n" + (issues.length() == 0 ? "- 本周未记录明确阻塞。\n" : issues.toString())
                + "\n## 下周计划\n" + (count == 0 ? "- 下周继续推进当前重点任务。" : "- 继续跟进本周完成事项的后续动作。");

        SQLiteDatabase writable = helper.getWritableDatabase();
        writable.execSQL("UPDATE weekly_reports SET is_current=0 WHERE week_start=?", new Object[]{weekStart});

        ContentValues values = new ContentValues();
        values.put("id", UUID.randomUUID().toString());
        values.put("week_start", weekStart);
        values.put("week_end", weekEnd);
        values.put("revision", nextRevision(weekStart));
        values.put("is_current", 1);
        values.put("content_markdown", markdown);
        values.put("created_at", System.currentTimeMillis());
        writable.insert("weekly_reports", null, values);
    }

    private int nextRevision(String weekStart) {
        SQLiteDatabase db = helper.getReadableDatabase();
        try (Cursor cursor = db.rawQuery("SELECT MAX(revision) FROM weekly_reports WHERE week_start=?", new String[]{weekStart})) {
            if (cursor.moveToFirst()) {
                return cursor.getInt(0) + 1;
            }
        }
        return 1;
    }

    private String getDailyRecord(String dateKey, String module, String fallback) {
        SQLiteDatabase db = helper.getReadableDatabase();
        try (Cursor cursor = db.rawQuery(
                "SELECT content_markdown FROM daily_records WHERE module=? AND record_date=? LIMIT 1",
                new String[]{module, dateKey})) {
            if (cursor.moveToFirst()) {
                return cursor.getString(0);
            }
        }
        return fallback;
    }

    private String getCurrentWeeklyReport(String weekStart) {
        SQLiteDatabase db = helper.getReadableDatabase();
        try (Cursor cursor = db.rawQuery(
                "SELECT content_markdown FROM weekly_reports WHERE week_start=? AND is_current=1 ORDER BY revision DESC LIMIT 1",
                new String[]{weekStart})) {
            if (cursor.moveToFirst()) {
                return cursor.getString(0);
            }
        }
        return "本周周报还没有生成。";
    }

    private TextView markdownCard(String value) {
        TextView view = text(value, 14, "#44403C", Typeface.NORMAL);
        view.setTextIsSelectable(true);
        view.setPadding(dp(14), dp(14), dp(14), dp(14));
        view.setBackground(cardBackground("#FFFFFF", "#E7E5E4", 18));
        return view;
    }

    private LinearLayout card() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(16), dp(16), dp(16), dp(16));
        layout.setBackground(cardBackground("#FFFFFF", "#E7E5E4", 22));
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, 0, 0, dp(12));
        layout.setLayoutParams(params);
        return layout;
    }

    private GradientDrawable cardBackground(String fill, String stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(Color.parseColor(fill));
        drawable.setCornerRadius(dp(radius));
        drawable.setStroke(dp(1), Color.parseColor(stroke));
        return drawable;
    }

    private TextView sectionTitle(String value) {
        TextView view = text(value, 18, "#181411", Typeface.BOLD);
        view.setPadding(0, dp(8), 0, dp(8));
        return view;
    }

    private TextView emptyText(String value) {
        TextView view = text(value, 14, "#78716C", Typeface.NORMAL);
        view.setPadding(dp(12), dp(8), dp(12), dp(12));
        return view;
    }

    private TextView text(String value, int size, String color, int style) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(Color.parseColor(color));
        view.setTypeface(Typeface.DEFAULT, style);
        view.setLineSpacing(dp(2), 1.0f);
        return view;
    }

    private EditText input(String hint, int lines) {
        EditText editText = new EditText(this);
        editText.setHint(hint);
        editText.setMinLines(lines);
        editText.setMaxLines(Math.max(lines, 5));
        editText.setTextSize(15);
        editText.setSingleLine(lines == 1);
        editText.setInputType(lines == 1 ? InputType.TYPE_CLASS_TEXT : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        editText.setPadding(dp(12), dp(10), dp(12), dp(10));
        editText.setBackground(cardBackground("#FAFAF9", "#E7E5E4", 14));
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(10), 0, 0);
        editText.setLayoutParams(params);
        return editText;
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        styleButton(button, true);
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(12), 0, 0);
        button.setLayoutParams(params);
        return button;
    }

    private Button outlineButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        styleButton(button, false);
        return button;
    }

    private void styleButton(Button button, boolean primary) {
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setTextColor(Color.parseColor(primary ? "#FFFFFF" : "#292524"));
        button.setBackground(cardBackground(primary ? "#181411" : "#FFFFFF", primary ? "#181411" : "#D6D3D1", 999));
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(-1, -2);
    }

    private void setStatus(String message) {
        statusMessage = message;
        render();
    }

    private void hideKeyboard(View view) {
        InputMethodManager manager = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (manager != null) {
            manager.hideSoftInputFromWindow(view.getWindowToken(), 0);
        }
    }

    private String todayKey() {
        return dateKey(System.currentTimeMillis());
    }

    private String dateKey(long time) {
        return dateFormat.format(new Date(time));
    }

    private String dateLabel(String dateKey) {
        try {
            return labelFormat.format(dateFormat.parse(dateKey));
        } catch (Exception ignored) {
            return dateKey;
        }
    }

    private String currentWeekStart() {
        return weekStart(todayKey());
    }

    private String weekStart(String dateKey) {
        Calendar calendar = Calendar.getInstance(Locale.CHINA);
        try {
            calendar.setTime(dateFormat.parse(dateKey));
        } catch (Exception ignored) {
            calendar.setTime(new Date());
        }

        while (calendar.get(Calendar.DAY_OF_WEEK) != Calendar.MONDAY) {
            calendar.add(Calendar.DATE, -1);
        }
        return dateFormat.format(calendar.getTime());
    }

    private String addDays(String dateKey, int days) {
        Calendar calendar = Calendar.getInstance(Locale.CHINA);
        try {
            calendar.setTime(dateFormat.parse(dateKey));
        } catch (Exception ignored) {
            calendar.setTime(new Date());
        }
        calendar.add(Calendar.DATE, days);
        return dateFormat.format(calendar.getTime());
    }

    private String metaLine(String mood, String tags) {
        List<String> items = new ArrayList<>();
        if (notBlank(mood)) {
            items.add("心情：" + mood);
        }
        if (notBlank(tags)) {
            items.add("标签：" + tags);
        }
        return join(items, "，");
    }

    private String join(List<String> values, String separator) {
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < values.size(); index += 1) {
            if (index > 0) {
                builder.append(separator);
            }
            builder.append(values.get(index));
        }
        return builder.toString();
    }

    private boolean notBlank(String value) {
        return value != null && value.trim().length() > 0;
    }

    private String emptyToNull(String value) {
        return notBlank(value) ? value : null;
    }

    private String safeText(String value) {
        return value == null ? "" : value;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private interface DiaryAction {
        void run() throws Exception;
    }

    private static class DiaryDb extends SQLiteOpenHelper {
        private static final int DB_VERSION = 2;

        DiaryDb(Context context) {
            super(context, "daily-trace-native.db", null, DB_VERSION);
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            createSchema(db);
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            try {
                ensureSchema(db);
            } catch (SQLiteException error) {
                Log.e(TAG, "Database migration failed; recreating local schema", error);
                recreateSchema(db);
            }
        }

        @Override
        public void onOpen(SQLiteDatabase db) {
            super.onOpen(db);
            if (!db.isReadOnly()) {
                try {
                    ensureSchema(db);
                } catch (SQLiteException error) {
                    Log.e(TAG, "Database schema check failed", error);
                }
            }
        }

        private void recreateSchema(SQLiteDatabase db) {
            db.execSQL("DROP TABLE IF EXISTS entries");
            db.execSQL("DROP TABLE IF EXISTS daily_records");
            db.execSQL("DROP TABLE IF EXISTS weekly_reports");
            createSchema(db);
        }

        private void ensureSchema(SQLiteDatabase db) {
            createSchema(db);
            ensureColumn(db, "entries", "id", "TEXT");
            ensureColumn(db, "entries", "module", "TEXT");
            ensureColumn(db, "entries", "occurred_at", "INTEGER");
            ensureColumn(db, "entries", "local_date", "TEXT");
            ensureColumn(db, "entries", "title", "TEXT");
            ensureColumn(db, "entries", "content", "TEXT");
            ensureColumn(db, "entries", "mood", "TEXT");
            ensureColumn(db, "entries", "tags", "TEXT");
            ensureColumn(db, "entries", "task_status", "TEXT");
            ensureColumn(db, "entries", "completed_at", "INTEGER");
            ensureColumn(db, "entries", "completed_local_date", "TEXT");
            ensureColumn(db, "entries", "deleted_at", "INTEGER");
            ensureColumn(db, "entries", "created_at", "INTEGER");
            ensureColumn(db, "entries", "updated_at", "INTEGER");

            ensureColumn(db, "daily_records", "id", "TEXT");
            ensureColumn(db, "daily_records", "module", "TEXT");
            ensureColumn(db, "daily_records", "record_date", "TEXT");
            ensureColumn(db, "daily_records", "content_markdown", "TEXT");
            ensureColumn(db, "daily_records", "updated_at", "INTEGER");

            ensureColumn(db, "weekly_reports", "id", "TEXT");
            ensureColumn(db, "weekly_reports", "week_start", "TEXT");
            ensureColumn(db, "weekly_reports", "week_end", "TEXT");
            ensureColumn(db, "weekly_reports", "revision", "INTEGER");
            ensureColumn(db, "weekly_reports", "is_current", "INTEGER");
            ensureColumn(db, "weekly_reports", "content_markdown", "TEXT");
            ensureColumn(db, "weekly_reports", "created_at", "INTEGER");
        }

        private void createSchema(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, module TEXT NOT NULL, occurred_at INTEGER NOT NULL, local_date TEXT NOT NULL, title TEXT, content TEXT, mood TEXT, tags TEXT, task_status TEXT, completed_at INTEGER, completed_local_date TEXT, deleted_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS daily_records (id TEXT PRIMARY KEY, module TEXT NOT NULL, record_date TEXT NOT NULL, content_markdown TEXT NOT NULL, updated_at INTEGER NOT NULL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS weekly_reports (id TEXT PRIMARY KEY, week_start TEXT NOT NULL, week_end TEXT NOT NULL, revision INTEGER NOT NULL, is_current INTEGER NOT NULL, content_markdown TEXT NOT NULL, created_at INTEGER NOT NULL)");
            db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_records_unique ON daily_records(module, record_date)");
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_entries_life_date ON entries(module, local_date)");
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_entries_work_completed ON entries(module, completed_local_date, task_status)");
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_weekly_reports_current ON weekly_reports(week_start, is_current, revision)");
        }

        private void ensureColumn(SQLiteDatabase db, String table, String column, String definition) {
            if (!hasColumn(db, table, column)) {
                db.execSQL("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
            }
        }

        private boolean hasColumn(SQLiteDatabase db, String table, String column) {
            try (Cursor cursor = db.rawQuery("PRAGMA table_info(" + table + ")", null)) {
                while (cursor.moveToNext()) {
                    if (column.equals(cursor.getString(cursor.getColumnIndexOrThrow("name")))) {
                        return true;
                    }
                }
            }
            return false;
        }
    }
}

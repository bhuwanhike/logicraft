package com.logicraft.support;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.IntFunction;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * A JdbcTemplate that records statements instead of executing them.
 *
 * The controllers here build their SQL by string concatenation and bind every
 * value as a parameter, so what matters to a test is the statement that was sent
 * and the arguments bound to it — not a result set. This records both and hands
 * back whatever the test wants returned.
 *
 * A hand-written stub rather than a mock: Mockito's inline mock maker cannot
 * instrument JdbcTemplate on the JDK this machine currently defaults to, and a
 * subclass that overrides three methods is a smaller dependency than a mocking
 * framework. It also makes the failure path explicit — a test that wants a
 * database error says so with {@link #failsWith} rather than stubbing a void.
 */
public class RecordingJdbcTemplate extends JdbcTemplate {

    /** One statement the controller sent, and the JdbcTemplate method it arrived through. */
    public record Query(String method, String sql, Object[] args) {
        /** The arguments as a list, for readable assertions. */
        public List<Object> argsList() {
            return Arrays.asList(args);
        }
    }

    private final List<Query> queries = new ArrayList<>();
    private final Deque<List<Map<String, Object>>> queued = new ArrayDeque<>();

    private List<Map<String, Object>> rows = List.of();
    private Map<String, Object> rowMap = Map.of();
    private IntFunction<Map<String, Object>> rowMapAnswers;
    private Object scalar;
    private IntFunction<Object> scalarAnswers;
    private int updateCount = 1;
    private RuntimeException failure;

    // ── configuration ────────────────────────────────────────────────

    /** Rows returned by the next queryForList. */
    public RecordingJdbcTemplate returning(List<Map<String, Object>> rows) {
        this.rows = rows;
        return this;
    }

    /**
     * Rows returned by successive queryForList calls, in order.
     *
     * For a controller that issues more than one statement — a page of rows and
     * then the milestones for those rows — a single fixed result would answer
     * both. The queue is consumed as the statements arrive and, once empty, the
     * default rows are used, so a test only has to queue the calls it cares
     * about.
     */
    @SafeVarargs
    public final RecordingJdbcTemplate returningInOrder(List<Map<String, Object>>... responses) {
        this.queued.addAll(Arrays.asList(responses));
        return this;
    }

    /** A single row map, for convenience. */
    public RecordingJdbcTemplate returning(Map<String, Object> row) {
        this.rows = List.of(row);
        return this;
    }

    /** A row built from alternating key/value arguments. */
    public static Map<String, Object> row(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            map.put(String.valueOf(pairs[i]), pairs[i + 1]);
        }
        return map;
    }

    /** The map returned by queryForMap. */
    public RecordingJdbcTemplate returningMap(Map<String, Object> map) {
        this.rowMap = map;
        return this;
    }

    /**
     * Answers successive queryForMap calls from a function of the call index.
     *
     * A controller that reads six aggregates in one request gets one answer per
     * statement this way, so each figure can be told apart. Without it every call
     * returns the same map and a test cannot say which statement produced which
     * number. The index counts queryForMap calls only.
     */
    public RecordingJdbcTemplate answeringMaps(IntFunction<Map<String, Object>> answers) {
        this.rowMapAnswers = answers;
        return this;
    }

    /** The value returned by queryForObject. */
    public RecordingJdbcTemplate returningScalar(Object value) {
        this.scalar = value;
        return this;
    }

    /**
     * Answers successive queryForObject calls from a function of the call index.
     *
     * A service that reads a count, then an inserted id, then a lookup id gets a
     * different answer per statement this way. Without it every call returns the
     * same scalar and a test cannot tell the pre-flight check from the insert.
     * The index counts queryForObject calls only.
     */
    public RecordingJdbcTemplate answeringScalars(IntFunction<Object> answers) {
        this.scalarAnswers = answers;
        return this;
    }

    /** The count returned by update. */
    public RecordingJdbcTemplate updating(int count) {
        this.updateCount = count;
        return this;
    }

    /** Makes every statement fail, to exercise a controller's error path. */
    public RecordingJdbcTemplate failsWith(RuntimeException failure) {
        this.failure = failure;
        return this;
    }

    // ── recorded state ───────────────────────────────────────────────

    public List<Query> queries() {
        return queries;
    }

    public Query last() {
        if (queries.isEmpty()) {
            throw new IllegalStateException("No statement was sent to the database");
        }
        return queries.get(queries.size() - 1);
    }

    public String lastSql() {
        return last().sql();
    }

    public List<Object> lastArgs() {
        return last().argsList();
    }

    public int queryCount() {
        return queries.size();
    }

    /** Only the statements that arrived through queryForList. */
    public List<Query> listQueries() {
        return queries.stream().filter(q -> q.method().equals("queryForList")).toList();
    }

    /** Only the statements that arrived through queryForMap, in the order sent. */
    public List<Query> mapQueries() {
        return queries.stream().filter(q -> q.method().equals("queryForMap")).toList();
    }

    /** Only the statements that arrived through queryForObject, in the order sent. */
    public List<Query> objectQueries() {
        return queries.stream().filter(q -> q.method().equals("queryForObject")).toList();
    }

    /** Only the statements that arrived through update, in the order sent. */
    public List<Query> updateQueries() {
        return queries.stream().filter(q -> q.method().equals("update")).toList();
    }

    // ── JdbcTemplate overrides ───────────────────────────────────────

    @Override
    public List<Map<String, Object>> queryForList(String sql, Object... args) {
        queries.add(new Query("queryForList", sql, args));
        if (failure != null) {
            throw failure;
        }
        return queued.isEmpty() ? rows : queued.poll();
    }

    @Override
    public Map<String, Object> queryForMap(String sql, Object... args) {
        queries.add(new Query("queryForMap", sql, args));
        if (failure != null) {
            throw failure;
        }
        return rowMapAnswers == null ? rowMap : rowMapAnswers.apply(mapQueries().size() - 1);
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType) {
        queries.add(new Query("queryForObject", sql, new Object[0]));
        if (failure != null) {
            throw failure;
        }
        return requiredType.cast(scalarForCall());
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
        queries.add(new Query("queryForObject", sql, args));
        if (failure != null) {
            throw failure;
        }
        return requiredType.cast(scalarForCall());
    }

    @Override
    public int update(String sql, Object... args) {
        queries.add(new Query("update", sql, args));
        if (failure != null) {
            throw failure;
        }
        return updateCount;
    }

    @Override
    public int update(String sql) {
        return update(sql, new Object[0]);
    }

    private Object scalarForCall() {
        return scalarAnswers == null ? scalar : scalarAnswers.apply(objectQueries().size() - 1);
    }
}

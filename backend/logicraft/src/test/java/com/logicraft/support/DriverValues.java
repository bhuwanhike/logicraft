package com.logicraft.support;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Map;

/**
 * Stand-ins for the values the PostgreSQL driver returns for column types that
 * Jackson cannot serialise usefully.
 *
 * A TEXT[] column arrives as an org.postgresql.jdbc.PgArray and a jsonb column
 * as an org.postgresql.util.PGobject. Both are beans, and the workspace table
 * calls String() on every cell — which is how "[object Object]" reached the UI.
 * GenericController unwraps them; these are the inputs for the tests of that.
 */
public final class DriverValues {

    private DriverValues() {
    }

    /**
     * A stand-in for PgArray that returns the given value from getArray().
     *
     * Proxy rather than a hand-written class: java.sql.Array declares twelve
     * methods and the controller calls exactly one of them.
     */
    public static java.sql.Array textArray(Object inner) {
        return array(() -> inner);
    }

    /** A stand-in for a PgArray whose getArray() fails, as a closed connection would. */
    public static java.sql.Array brokenArray(String message) {
        return array(() -> {
            throw new SQLException(message);
        });
    }

    private static java.sql.Array array(SqlSupplier getArray) {
        InvocationHandler handler = (proxy, method, args) -> {
            return switch (method.getName()) {
                case "getArray" -> getArray.get();
                case "getBaseType" -> Types.ARRAY;
                case "getArrayType" -> Types.VARCHAR;
                case "getBaseTypeName" -> "varchar[]";
                case "toString" -> "pg-array-stub";
                case "hashCode" -> System.identityHashCode(proxy);
                case "equals" -> proxy == args[0];
                default -> throw new UnsupportedOperationException(method.getName());
            };
        };
        return (java.sql.Array) Proxy.newProxyInstance(
            DriverValues.class.getClassLoader(),
            new Class<?>[] {java.sql.Array.class},
            handler);
    }

    /**
     * A stand-in for a jsonb PGobject.
     *
     * The driver is a runtime dependency, so the class is not on the compile
     * classpath and cannot be named here — which is also why the controller
     * matches it by name and unwraps it reflectively.
     */
    public static Object jsonb(String json) {
        try {
            Object value = Class.forName("org.postgresql.util.PGobject")
                .getDeclaredConstructor().newInstance();
            value.getClass().getMethod("setValue", String.class).invoke(value, json);
            return value;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("PostgreSQL driver not on the test classpath", e);
        }
    }

    /** The class name the controller matches jsonb values on. */
    public static final String PGOBJECT = "org.postgresql.util.PGobject";

    /** A read-only copy of a row, for tests that assert on the response body. */
    public static Map<String, Object> map(Object... pairs) {
        return RecordingJdbcTemplate.row(pairs);
    }

    @FunctionalInterface
    private interface SqlSupplier {
        Object get() throws SQLException;
    }
}

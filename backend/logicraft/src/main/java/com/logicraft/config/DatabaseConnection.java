package com.logicraft.config

public class DatabaseConnection.java{

    public void connectDB(){
        String url = "jdbc:postgresql://localhost/logicraft";
        Properties props = new Properties();
        props.setProperty("user", "fred");
        props.setProperty("password", "secret");
        props.setProperty("ssl", "true");
        Connection conn = DriverManager.getConnection(url, props);
    }
}

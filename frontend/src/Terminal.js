import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import { io } from "socket.io-client";

const WHITELIST = [
  "nc", "netcat", "cd", "ls", "pwd", "help", "man", "time", "clear", "exit",
  "echo", "alias", "unalias", "export", "unset", "set", "history", "type", "read", "let", "test",
  "if", "then", "else", "fi", "for", "while", "do", "done", "break", "continue", "eval", "exec", "trap", "source", ".", "jobs", "fg", "bg", "kill", "wait", "times"
];

export default function TerminalComponent({ token }) {
  const xtermRef = useRef();
  const socketRef = useRef();
  const term = useRef();

  useEffect(() => {
    term.current = new Terminal({
      fontSize: 16,
      theme: { background: "#1a1a1a" },
      cursorBlink: true,
      rows: 24,
      cols: 80,
    });
    term.current.open(xtermRef.current);
    term.current.write("Welcome to Netcat listener as a service Terminal!\r\n");
    term.current.prompt = () => {
      term.current.write("$ ");
    };
    term.current.prompt();

    socketRef.current = io("/terminal", {
      auth: { token },
      path: "/socket.io"
    });

    term.current.onData((data) => {
      socketRef.current.emit("input", data);
    });

    socketRef.current.on("output", (data) => {
      term.current.write(data);
    });

    return () => {
      term.current.dispose();
      socketRef.current.disconnect();
    };
  }, [token]);

  return <div ref={xtermRef} style={{ width: "100%", height: "400px", background: "#1a1a1a" }} />;
} 
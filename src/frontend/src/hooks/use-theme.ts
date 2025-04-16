import { useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "system"
  )

  useEffect(() => {
    const root = window.document.documentElement
    
    // Remove old class
    root.classList.remove("light", "dark")

    // Add new class based on theme
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  useEffect(() => {
    // Save theme to localStorage
    localStorage.setItem("theme", theme)
  }, [theme])

  return { theme, setTheme }
}

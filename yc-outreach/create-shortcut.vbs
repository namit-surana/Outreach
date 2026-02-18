Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.ExpandEnvironmentStrings("%USERPROFILE%") & "\Desktop\YC Outreach.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "C:\Users\hp\.openclaw\workspace\projects\job-hunt\yc-outreach\start-yc-outreach.bat"
oLink.WorkingDirectory = "C:\Users\hp\.openclaw\workspace\projects\job-hunt\yc-outreach"
oLink.Description = "Start YC Outreach Application (Frontend & Backend)"
oLink.IconLocation = "C:\Windows\System32\SHELL32.dll,22"
oLink.Save
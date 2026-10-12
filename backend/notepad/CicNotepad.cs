// Fixed Windows 10 Notepad pilot. No arbitrary HWND/path/key/shell API.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;
class CicNotepad : Form {
 [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h,int id,uint modifiers,uint key);
 [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h,int id);
 [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr c);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb,IntPtr data);
 delegate bool EnumProc(IntPtr h,IntPtr d);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent,IntPtr after,string cls,string title);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint id,ref GuiInfo info);
 [DllImport("user32.dll")] static extern bool IsChild(IntPtr parent,IntPtr child);
 [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h,uint msg,IntPtr wp,StringBuilder lp,uint flags,uint timeout,out IntPtr result);
 [DllImport("user32.dll",EntryPoint="SendMessageTimeoutW")] static extern IntPtr SendControlTimeout(IntPtr h,uint msg,IntPtr wp,IntPtr lp,uint flags,uint timeout,out IntPtr result);
 [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll")] static extern uint SendInput(uint count,Input[] input,int size);
 [StructLayout(LayoutKind.Sequential)] struct Rect {public int left,top,right,bottom;}
 [StructLayout(LayoutKind.Sequential)] struct GuiInfo {public uint cbSize,flags;public IntPtr active,focus,capture,menu,move,caret;public Rect caretRect;}
 [StructLayout(LayoutKind.Sequential)] struct Keyboard {public ushort vk,scan;public uint flags,time;public IntPtr extra;}
 [StructLayout(LayoutKind.Explicit,Size=32)] struct InputUnion {[FieldOffset(0)]public Keyboard keyboard;}
 [StructLayout(LayoutKind.Sequential)] struct Input {public uint type;public InputUnion data;}
 readonly Label status=new Label();readonly System.Windows.Forms.Timer watchdog=new System.Windows.Forms.Timer();
 readonly object outputLock=new object(),actionLock=new object();readonly HashSet<string> grants=new HashSet<string>(),tasks=new HashSet<string>(),operations=new HashSet<string>();
 string nonce,lastId,exe;long heartbeat=Stopwatch.GetTimestamp(),lastStamp,startTicks;double deadline;Process target;IntPtr window,editor;volatile bool stopped;bool busy;
 CicNotepad(){Text="CIC · Notepad controller (new window only)";ClientSize=new Size(560,180);Font=new Font("Tahoma",11);status.Text="CIC ควบคุมเฉพาะ Notepad ใหม่ของรอบนี้\nหยุดได้ด้วยปุ่มแดงหรือ Ctrl+Alt+F9\nหยุดแล้ว Notepad และข้อความยังอยู่ให้คุณตรวจ";status.Location=new Point(15,15);status.Size=new Size(530,90);Controls.Add(status);var stop=new Button{Text="หยุดควบคุม Notepad",BackColor=Color.LightCoral,Location=new Point(15,110),Size=new Size(530,50)};stop.Click+=(s,e)=>Shutdown();Controls.Add(stop);FormClosed+=(s,e)=>Shutdown();Shown+=(s,e)=>{Interlocked.Exchange(ref heartbeat,Stopwatch.GetTimestamp());if(!RegisterHotKey(Handle,27,0x4000|0x1|0x2,0x78)){Shutdown();return;}new Thread(Read){IsBackground=true}.Start();watchdog.Interval=50;watchdog.Tick+=(a,b)=>{if(Age(Interlocked.Read(ref heartbeat))>2000)Shutdown();};watchdog.Start();};}
 protected override bool ShowWithoutActivation{get{return true;}}
 protected override void WndProc(ref Message m){if(m.Msg==0x312&&m.WParam.ToInt32()==27){Shutdown();return;}base.WndProc(ref m);}
 void Shutdown(){stopped=true;UnregisterHotKey(Handle,27);Environment.Exit(0);}
 static double Now(){return Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;}
 static double Age(long stamp){return (Stopwatch.GetTimestamp()-stamp)*1000.0/Stopwatch.Frequency;}
 static bool Exact(Dictionary<string,object> v,params string[] keys){if(v.Count!=keys.Length)return false;foreach(var k in keys)if(!v.ContainsKey(k))return false;return true;}
 static string S(Dictionary<string,object> v,string k){object value;return v.TryGetValue(k,out value)?value as string:null;}
 static bool Uuid(string v){Guid g;return Guid.TryParse(v,out g);}
 static string Class(IntPtr h){var s=new StringBuilder(128);GetClassName(h,s,s.Capacity);return s.ToString();}
 static bool TextOk(string text){if(String.IsNullOrEmpty(text)||text.Length>200)return false;foreach(char c in text)if((Char.IsControl(c)&&c!='\n')||Char.IsSurrogate(c))return false;return true;}
 void Reply(string id,object v,string error=null){lock(outputLock){Console.WriteLine(new JavaScriptSerializer().Serialize(error==null?(object)new{id=id,value=v}:new{id=id,error=error}));Console.Out.Flush();}}
 void Launch(){exe=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"notepad.exe");target=Process.Start(new ProcessStartInfo(exe){UseShellExecute=false});startTicks=target.StartTime.ToUniversalTime().Ticks;for(int n=0;n<80;n++){if(stopped||target.HasExited)throw new Exception("notepad-process-reused-or-exited");var found=new List<IntPtr>();EnumWindows((h,d)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==(uint)target.Id&&Class(h)=="Notepad"&&IsWindowVisible(h))found.Add(h);return true;},IntPtr.Zero);if(found.Count>1)throw new Exception("ambiguous-window");if(found.Count==1){window=found[0];break;}Thread.Sleep(50);}if(window==IntPtr.Zero)throw new Exception("notepad-window-not-found");editor=FindWindowEx(window,IntPtr.Zero,"Edit",null);if(editor==IntPtr.Zero||FindWindowEx(window,editor,"Edit",null)!=IntPtr.Zero)throw new Exception("notepad-editor-unsupported");ValidateTarget();var el=AutomationElement.FromHandle(editor);if(el.Current.ProcessId!=target.Id||(el.Current.ControlType!=ControlType.Edit&&el.Current.ControlType!=ControlType.Document))throw new Exception("notepad-uia-unsupported");if(ReadText()!="")throw new Exception("document-not-empty");}
 void ValidateTarget(){uint p,q;if(stopped||target==null||target.HasExited||target.StartTime.ToUniversalTime().Ticks!=startTicks||!String.Equals(target.MainModule.FileName,exe,StringComparison.OrdinalIgnoreCase)||!IsWindow(window)||!IsWindow(editor)||Class(window)!="Notepad"||Class(editor)!="Edit"||!IsChild(window,editor)||GetWindowThreadProcessId(window,out p)==0||p!=(uint)target.Id||GetWindowThreadProcessId(editor,out q)==0||q!=p||!IsWindowVisible(window)||IsIconic(window))throw new Exception("target-changed");}
 string Geometry(){Rect w,e;if(!GetWindowRect(window,out w)||!GetWindowRect(editor,out e))throw new Exception("target-changed");return target.Id+":"+startTicks+":"+window.ToInt64()+":"+editor.ToInt64()+":"+w.left+","+w.top+","+w.right+","+w.bottom+":"+e.left+","+e.top+","+e.right+","+e.bottom+":"+GetDpiForWindow(window);}
 string ReadText(){ValidateTarget();var s=new StringBuilder(802);IntPtr result;if(SendMessageTimeout(editor,0x000d,new IntPtr(s.Capacity),s,0x2|0x20,500,out result)==IntPtr.Zero)throw new Exception("editor-read-timeout");if(result.ToInt64()>800)throw new Exception("text-limit");return s.ToString().Replace("\r\n","\n");}
 object Observe(){ValidateTarget();lastId=Guid.NewGuid().ToString();lastStamp=Stopwatch.GetTimestamp();return new{instanceId=nonce,observationId=lastId,monotonicMs=Now(),geometry=Geometry(),pid=target.Id,windowId=window.ToInt64().ToString(),foreground=GetForegroundWindow()==window,text=ReadText(),source="owned-notepad-editor"};}
 bool EditorFocused(){if(GetForegroundWindow()!=window)return false;var info=new GuiInfo{cbSize=(uint)Marshal.SizeOf(typeof(GuiInfo))};return GetGUIThreadInfo(0,ref info)&&(info.focus==editor||IsChild(editor,info.focus));}
 bool Uncovered(){Rect r;if(!GetWindowRect(editor,out r))return false;foreach(var p in new[]{new Point(r.left+5,r.top+5),new Point(r.right-6,r.top+5),new Point(r.left+5,r.bottom-6),new Point(r.right-6,r.bottom-6),new Point((r.left+r.right)/2,(r.top+r.bottom)/2)})if(GetAncestor(WindowFromPoint(p),2)!=window)return false;return true;}
 void Preconditions(string geometry){ValidateTarget();if(Now()>=deadline||Geometry()!=geometry||!EditorFocused()||!Uncovered())throw new Exception("focus-or-target-changed");foreach(int key in new[]{0x10,0x11,0x12,0x5b,0x5c})if((GetAsyncKeyState(key)&0x8000)!=0)throw new Exception("modifier-held");}
 object Append(Dictionary<string,object> v){string text=S(v,"text"),geometry=S(v,"geometry"),expected=S(v,"expectedText"),grant=S(v,"grantId"),task=S(v,"taskId"),op=S(v,"operationId");double end;if(!TextOk(text)||expected==null||expected.Length>800||expected.Replace("\n","\r\n").Length+text.Replace("\n","\r\n").Length>800||S(v,"permission")!="notepad.append"||Convert.ToString(v["policyVersion"])!="1"||!Uuid(grant)||!Uuid(task)||!Uuid(op)||grants.Count>=32||grants.Contains(grant)||tasks.Contains(task)||operations.Contains(op)||S(v,"observationId")!=lastId||Age(lastStamp)>1000||!Double.TryParse(Convert.ToString(v["deadlineMs"]),out end)||Double.IsNaN(end)||Double.IsInfinity(end)||end<=Now()||end-Now()>30000)throw new Exception("permission-denied");deadline=end;ValidateTarget();if(Geometry()!=geometry||ReadText()!=expected)throw new Exception("target-changed");grants.Add(grant);tasks.Add(task);operations.Add(op);
  SetForegroundWindow(window);AutomationElement.FromHandle(editor).SetFocus();Thread.Sleep(40);Preconditions(geometry);var before=Observe();
  // Set a collapsed end selection only on the verified Edit handle; no global modifier key.
  IntPtr selected;Preconditions(geometry);if(SendControlTimeout(editor,0x00b1,new IntPtr(Int32.MaxValue),new IntPtr(Int32.MaxValue),0x2|0x20,500,out selected)==IntPtr.Zero)throw new Exception("editor-read-timeout");
  foreach(char c in text){Preconditions(geometry);if(c=='\n')SendPair(0x0d,0,0,geometry);else SendPair(0,c,0x4,geometry);Thread.Sleep(2);}
  Thread.Sleep(80);Preconditions(geometry);var actual=ReadText();if(actual!=expected+text)throw new Exception("verification-failed-partial-text");return new{before=before,after=Observe()};
 }
 void SendPair(ushort vk,ushort scan,uint flags,string geometry){Preconditions(geometry);var down=new Input{type=1,data=new InputUnion{keyboard=new Keyboard{vk=vk,scan=scan,flags=flags}}};var up=new Input{type=1,data=new InputUnion{keyboard=new Keyboard{vk=vk,scan=scan,flags=flags|0x2}}};uint n=SendInput(2,new[]{down,up},Marshal.SizeOf(typeof(Input)));if(n!=2){if(n==1)SendInput(1,new[]{up},Marshal.SizeOf(typeof(Input)));throw new Exception("input-blocked");}}
 void Read(){try{string line;while((line=Console.ReadLine())!=null){if(line.Length>8192)break;Dictionary<string,object> v;try{v=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(line);}catch{break;}if(nonce==null){if(!Exact(v,"nonce","id","command")||!Uuid(S(v,"nonce"))||!Uuid(S(v,"id"))||S(v,"command")!="init")break;nonce=S(v,"nonce");var id=S(v,"id");new Thread(()=>{try{Launch();Reply(id,Observe());}catch(Exception e){Reply(id,null,Code(e));}}){IsBackground=true}.Start();continue;}if(S(v,"nonce")!=nonce)break;string command=S(v,"command"),rid=S(v,"id");if(command=="heartbeat"&&Exact(v,"nonce","command")){Interlocked.Exchange(ref heartbeat,Stopwatch.GetTimestamp());continue;}if(!Uuid(rid))break;if(command=="observe"&&Exact(v,"nonce","id","command")){lock(actionLock){if(busy){Reply(rid,null,"busy");continue;}busy=true;}new Thread(()=>{try{Reply(rid,Observe());}catch(Exception e){Reply(rid,null,Code(e));}finally{lock(actionLock)busy=false;}}){IsBackground=true}.Start();continue;}if(command=="execute"&&Exact(v,"nonce","id","command","text","geometry","observationId","expectedText","permission","policyVersion","taskId","operationId","grantId","deadlineMs")){lock(actionLock){if(busy){Reply(rid,null,"busy");continue;}busy=true;}new Thread(()=>{try{Reply(rid,Append(v));}catch(Exception e){Reply(rid,null,Code(e));}finally{lock(actionLock)busy=false;}}){IsBackground=true}.Start();continue;}Reply(rid,null,"invalid");}}catch{}try{BeginInvoke((Action)Shutdown);}catch{Environment.Exit(0);}}
 static string Code(Exception e){var allowed=new[]{"notepad-process-reused-or-exited","ambiguous-window","unsupported-notepad","notepad-window-not-found","notepad-editor-unsupported","notepad-uia-unsupported","document-not-empty","target-changed","text-limit","editor-read-timeout","permission-denied","focus-or-target-changed","verification-failed-partial-text","input-blocked","modifier-held"};return Array.IndexOf(allowed,e.Message)>=0?e.Message:"native-failed";}
 [STAThread] static void Main(){Console.OutputEncoding=new UTF8Encoding(false);Console.InputEncoding=new UTF8Encoding(false);if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))return;Application.EnableVisualStyles();Application.Run(new CicNotepad());}
}

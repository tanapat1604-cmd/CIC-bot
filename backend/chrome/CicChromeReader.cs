// Development adapter: public search in one new normal Chrome window, read only.
// No debugger, profile/cookie access, arbitrary HWND, input injection or close-Chrome.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web;
using System.Web.Script.Serialization;
using System.Windows.Automation;
class CicChromeReader {
 const string Chrome="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
 [DllImport("user32.dll")]static extern bool EnumWindows(EnumProc callback,IntPtr data);
 delegate bool EnumProc(IntPtr window,IntPtr data);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 [DllImport("user32.dll")]static extern bool IsWindow(IntPtr window);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr window);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetClassName(IntPtr window,StringBuilder value,int count);
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr window,out Rect value);
 [StructLayout(LayoutKind.Sequential)]struct Rect {public int left,top,right,bottom;}
 static string nonce,query;static IntPtr target;static int pid;static long startTicks;
 static long heartbeat=Stopwatch.GetTimestamp();static readonly long created=Stopwatch.GetTimestamp();static bool busy;static readonly object gate=new object(),output=new object();
 static double Now(){return Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;}
 static bool Exact(Dictionary<string,object> v,params string[] names){if(v.Count!=names.Length)return false;foreach(string name in names)if(!v.ContainsKey(name))return false;return true;}
 static string S(Dictionary<string,object> v,string key){object value;return v.TryGetValue(key,out value)?value as string:null;}
 static bool Uuid(string value){Guid g;return Guid.TryParse(value,out g);}
 static string Class(IntPtr h){var s=new StringBuilder(128);GetClassName(h,s,s.Capacity);return s.ToString();}
 static bool ChromeWindow(IntPtr h){try{uint p;GetWindowThreadProcessId(h,out p);return IsWindowVisible(h)&&Class(h)=="Chrome_WidgetWin_1"&&String.Equals(Process.GetProcessById((int)p).MainModule.FileName,Chrome,StringComparison.OrdinalIgnoreCase);}catch{return false;}}
 static List<IntPtr> Windows(){var windows=new List<IntPtr>();EnumWindows((h,d)=>{if(ChromeWindow(h))windows.Add(h);return true;},IntPtr.Zero);return windows;}
 static void Validate(){uint p;GetWindowThreadProcessId(target,out p);if(!IsWindow(target)||!ChromeWindow(target)||p!=pid||Process.GetProcessById(pid).StartTime.ToUniversalTime().Ticks!=startTicks||IsIconic(target))throw new Exception("target-changed");}
 static void Reply(string id,object value,string error=null){lock(output){Console.WriteLine(new JavaScriptSerializer{MaxJsonLength=60000}.Serialize(error==null?(object)new{id=id,value=value}:new{id=id,error=error}));Console.Out.Flush();}}
 static bool QueryOk(string value){if(String.IsNullOrWhiteSpace(value)||value.Length>200)return false;foreach(char c in value)if(Char.IsControl(c)||Char.IsSurrogate(c))return false;return true;}
 static void Launch(string value){
  if(!QueryOk(value)||!File.Exists(Chrome))throw new Exception("invalid-query");query=value;
  var before=new HashSet<IntPtr>(Windows());
  var launcher=Process.Start(new ProcessStartInfo(Chrome,"--new-window https://www.google.com/search?q="+Uri.EscapeDataString(query)){UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true});
  launcher.OutputDataReceived+=(s,e)=>{};launcher.ErrorDataReceived+=(s,e)=>{};launcher.BeginOutputReadLine();launcher.BeginErrorReadLine();
  launcher.Dispose();
  for(int n=0;n<160;n++){
   var found=Windows().FindAll(h=>!before.Contains(h));
   if(found.Count>1)throw new Exception("ambiguous-new-window");
   if(found.Count==1){target=found[0];uint p;GetWindowThreadProcessId(target,out p);pid=(int)p;startTicks=Process.GetProcessById(pid).StartTime.ToUniversalTime().Ticks;Validate();return;}
   Thread.Sleep(50);
  }
  throw new Exception("new-window-not-found");
 }
 static string Cut(string value,int max){value=value??"";return value.Length>max?value.Substring(0,max):value;}
 static bool SearchUrl(string value){Uri uri;if(!Uri.TryCreate(value.StartsWith("https://")?value:"https://"+value,UriKind.Absolute,out uri))return false;return uri.Scheme=="https"&&(uri.Host=="www.google.com"||uri.Host=="google.com")&&uri.AbsolutePath=="/search"&&HttpUtility.ParseQueryString(uri.Query)["q"]==query;}
 static bool ContentLink(AutomationElement element){
  try{
   var role=AutomationProperty.LookupById(30101);
   var descendants=element.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Text));
   for(int i=0;i<Math.Min(descendants.Count,40);i++){
    var h=descendants[i];
    if(role!=null&&String.Equals(h.GetCurrentPropertyValue(role) as string,"heading",StringComparison.Ordinal))return true;
    if(String.Equals(h.Current.LocalizedControlType,"heading",StringComparison.OrdinalIgnoreCase))return true;
   }
  }catch{}
  return false;
 }
 static object Observe(){
  Validate();double began=Now();var root=AutomationElement.FromHandle(target);
  if(root.Current.ProcessId!=pid||root.Current.NativeWindowHandle!=target.ToInt64())throw new Exception("target-changed");
  bool urlVerified=false;var edits=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Edit));
  for(int i=0;i<Math.Min(edits.Count,80);i++){var el=edits[i];object pattern;if(!el.Current.IsOffscreen&&!el.Current.IsPassword&&el.TryGetCurrentPattern(ValuePattern.Pattern,out pattern)&&SearchUrl(((ValuePattern)pattern).Current.Value)){urlVerified=true;break;}}
  AutomationElement document=null;var docs=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Document));
  for(int i=0;i<Math.Min(docs.Count,20);i++){if(!docs[i].Current.IsOffscreen){document=docs[i];break;}}
  if(document==null)throw new Exception("document-not-ready");
  var nodes=new List<object>();var queue=new Queue<AutomationElement>();queue.Enqueue(document);var walker=TreeWalker.ControlViewWalker;
  string observationId=Guid.NewGuid().ToString();int visited=0;bool truncated=false;
  while(queue.Count>0){
   if(++visited>900||nodes.Count>=180||Now()-began>3000){truncated=true;break;}
   var element=queue.Dequeue();try{
    var current=element.Current;if(current.IsOffscreen||current.IsPassword)continue;
    string name=Cut(current.Name,240),role=current.ControlType.ProgrammaticName.Replace("ControlType.","");
    if(name.Length>0&&(role=="Text"||role=="Hyperlink"||role=="Button"||role=="Edit"||role=="Document"||role=="Header")){
     // No field values, credentials, cookies or browser-toolbar details exported.
     nodes.Add(new{reference=observationId+":"+nodes.Count,role=role,name=name,enabled=current.IsEnabled,contentLink=role=="Hyperlink"&&ContentLink(element)});
    }
    var child=walker.GetFirstChild(element);int children=0;while(child!=null&&children++<180){queue.Enqueue(child);child=walker.GetNextSibling(child);}
   }catch(ElementNotAvailableException){}catch(InvalidOperationException){}
  }
  Validate();Rect rect;if(!GetWindowRect(target,out rect))throw new Exception("target-changed");
  return new{source="native-chrome-uia",readOnly=true,instanceId=nonce,observationId=observationId,windowId=target.ToInt64().ToString(),pid=pid,startTicks=startTicks.ToString(),query=query,urlVerified=urlVerified,title=Cut(document.Current.Name,240),nodes=nodes,truncated=truncated,elapsedMs=Math.Round(Now()-began),geometry=new{left=rect.left,top=rect.top,right=rect.right,bottom=rect.bottom}};
 }
 static string Code(Exception e){return Array.IndexOf(new[]{"target-changed","invalid-query","ambiguous-new-window","new-window-not-found","document-not-ready"},e.Message)>=0?e.Message:"native-read-failed";}
 static void Dispatch(string id,string command,string value){lock(gate){if(busy){Reply(id,null,"busy");return;}busy=true;}new Thread(()=>{try{if(command=="init")Launch(value);Reply(id,Observe());}catch(Exception e){Reply(id,null,Code(e));}finally{lock(gate)busy=false;}}){IsBackground=true}.Start();}
 [STAThread]static void Main(){
  Console.OutputEncoding=new UTF8Encoding(false);Console.InputEncoding=new UTF8Encoding(false);
  using(var watchdog=new Timer(s=>{if(Now()-Interlocked.Read(ref heartbeat)*1000.0/Stopwatch.Frequency>3000||Now()-created*1000.0/Stopwatch.Frequency>120000)Environment.Exit(0);},null,100,100)){
   string line;while((line=Console.ReadLine())!=null){if(line.Length>4096)break;Dictionary<string,object> v;try{v=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(line);}catch{break;}
    if(nonce==null){if(!Exact(v,"nonce","id","command","query")||!Uuid(S(v,"nonce"))||!Uuid(S(v,"id"))||S(v,"command")!="init")break;nonce=S(v,"nonce");Dispatch(S(v,"id"),"init",S(v,"query"));continue;}
    if(S(v,"nonce")!=nonce)break;
    if(S(v,"command")=="heartbeat"&&Exact(v,"nonce","command")){Interlocked.Exchange(ref heartbeat,Stopwatch.GetTimestamp());continue;}
    if(S(v,"command")=="observe"&&Exact(v,"nonce","id","command")&&Uuid(S(v,"id"))){Dispatch(S(v,"id"),"observe",null);continue;}
    if(Uuid(S(v,"id")))Reply(S(v,"id"),null,"invalid");else break;
   }
  }
  // Ending observer releases the pipe only. Chrome belongs to the user and stays open.
 }
}

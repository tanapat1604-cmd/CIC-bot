// CIC owned-window UI Automation lab. .NET Framework 4.x / Windows only.
// No SendInput, arbitrary HWND, shell, clipboard, screenshot or network API.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;

class CicLab : Form {
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h,int id,uint modifiers,uint key);
 [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h,int id);
 [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint process);
 [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint flags);
 readonly Button click=new Button(), confirm=new Button(), stop=new Button();
 readonly TextBox text=new TextBox(); readonly TrackBar slider=new TrackBar(); readonly ListBox list=new ListBox();
 readonly Label message=new Label(), counter=new Label(); readonly System.Windows.Forms.Timer watchdog=new System.Windows.Forms.Timer();
 readonly object outputLock=new object(); readonly JavaScriptSerializer json=new JavaScriptSerializer();
 string nonce, pendingId, pendingAction, pendingText, pendingGeometry; int clicks; bool busy,closed,hotkey; long pendingSince; double pendingDeadline; string lastObservationId; long lastObservationStamp; string[] availableActions=new string[0]; readonly HashSet<string> grants=new HashSet<string>(),operations=new HashSet<string>(),tasks=new HashSet<string>();
 long heartbeat=Stopwatch.GetTimestamp();
 protected override bool ShowWithoutActivation { get { return true; } }
 CicLab(){
  Text="CIC · Native control lab (only this window)";ClientSize=new Size(750,520);Font=new Font("Tahoma",11);AutoScaleMode=AutoScaleMode.Dpi;StartPosition=FormStartPosition.CenterScreen;KeyPreview=true;
  var hint=new Label{Text="หน้าต่างทดสอบของ CIC เท่านั้น · ไม่ควบคุมแอปอื่น\nหลังอนุญาตในเว็บ กลับมาหน้านี้และตรวจงานก่อนกดปุ่มสีเขียว",Location=new Point(20,15),Size=new Size(710,60)};Controls.Add(hint);
  var random=new Random();click.Text="CIC target button";click.Name="click";click.Location=new Point(random.Next(20,180),85);click.Size=new Size(220,44);click.Click+=(s,e)=>{clicks++;counter.Text="Clicks: "+clicks;};Controls.Add(click);
  counter.Text="Clicks: 0";counter.Location=new Point(430,92);counter.AutoSize=true;Controls.Add(counter);
  text.Name="type";text.Location=new Point(20,150);text.Size=new Size(500,35);text.MaxLength=40;Controls.Add(text);
  slider.Name="slider";slider.Location=new Point(20,195);slider.Size=new Size(350,50);slider.Minimum=0;slider.Maximum=100;Controls.Add(slider);
  list.Name="scroll";list.Location=new Point(400,195);list.Size=new Size(300,150);for(int i=1;i<=50;i++)list.Items.Add("CIC visible row "+i);Controls.Add(list);
  message.Location=new Point(20,355);message.Size=new Size(710,65);message.Text="ยังไม่มีงานที่อนุญาต · ไม่มีการคลิกหรือพิมพ์อัตโนมัติ";Controls.Add(message);
  confirm.Text="ตรวจแล้ว ให้ CIC ทำงานนี้หนึ่งครั้ง";confirm.BackColor=Color.LightGreen;confirm.Location=new Point(20,430);confirm.Size=new Size(435,55);confirm.Enabled=false;confirm.Click+=(s,e)=>RunPending();Controls.Add(confirm);
  stop.Text="หยุด / ปิด Lab";stop.BackColor=Color.LightCoral;stop.Location=new Point(475,430);stop.Size=new Size(230,55);stop.Click+=(s,e)=>Shutdown();Controls.Add(stop);
  KeyDown+=(s,e)=>{if(e.KeyCode==Keys.Escape)Shutdown();};FormClosed+=(s,e)=>{closed=true;UnregisterHotKey(Handle,17);Environment.Exit(0);};
  Shown+=(s,e)=>{Interlocked.Exchange(ref heartbeat,Stopwatch.GetTimestamp());hotkey=RegisterHotKey(Handle,17,0x4000|0x1|0x2,0x78);if(!hotkey){Console.Error.WriteLine("hotkey-unavailable");message.Text="ลงทะเบียน Ctrl+Alt+F9 ไม่ได้ จึงปิด Lab";Shutdown();return;}new Thread(Read){IsBackground=true}.Start();watchdog.Interval=100;watchdog.Tick+=(a,b)=>{if(Age(Interlocked.Read(ref heartbeat))>2000)Shutdown();};watchdog.Start();};
 }
 protected override void WndProc(ref Message m){if(m.Msg==0x312&&m.WParam.ToInt32()==17){Shutdown();return;}base.WndProc(ref m);}
 void Shutdown(){Console.Error.WriteLine("owned-lab-shutdown");closed=true;confirm.Enabled=false;UnregisterHotKey(Handle,17);Environment.Exit(0);}
 static double Age(long timestamp){return (Stopwatch.GetTimestamp()-timestamp)*1000.0/Stopwatch.Frequency;}
 void Reply(string id,object value,string error=null){lock(outputLock){Console.WriteLine(new JavaScriptSerializer().Serialize(error==null?(object)new{id=id,value=value}:new{id=id,error=error}));Console.Out.Flush();}}
 T UI<T>(Func<T> f){return (T)Invoke(f);}
 Control Target(string action){return action=="click"?(Control)click:action=="type"?(Control)text:action=="slider"?(Control)slider:(Control)list;}
 bool OwnedForeground(){uint p;return !closed&&WindowState==FormWindowState.Normal&&GetForegroundWindow()==Handle&&GetWindowThreadProcessId(Handle,out p)!=0&&p==(uint)Process.GetCurrentProcess().Id;}
 string Geometry(){var all=new List<string>();all.Add(Handle.ToInt64()+":"+Bounds.ToString()+":"+GetDpiForWindow(Handle));foreach(var c in new Control[]{click,text,slider,list})all.Add(c.RectangleToScreen(c.ClientRectangle).ToString());return String.Join("|",all);}
 object Observe(){lastObservationId=Guid.NewGuid().ToString();lastObservationStamp=Stopwatch.GetTimestamp();var targets=new List<object>();foreach(var c in new Control[]{click,text,slider,list}){var r=c.RectangleToScreen(c.ClientRectangle);targets.Add(new{id=c.Name,name=c.Name,x=r.X,y=r.Y,width=r.Width,height=r.Height});}return new{instanceId=nonce,observationId=lastObservationId,monotonicMs=lastObservationStamp*1000.0/Stopwatch.Frequency,geometry=Geometry(),foreground=OwnedForeground(),clicks=clicks,text=text.Text,slider=slider.Value,top=list.TopIndex,dpi=GetDpiForWindow(Handle),source="owned-window-structure",availableActions=availableActions,targets=targets};}
 bool VisibleTarget(Control c){var r=c.RectangleToScreen(c.ClientRectangle);foreach(var p in new[]{new Point(r.Left+2,r.Top+2),new Point(r.Right-3,r.Top+2),new Point(r.Left+2,r.Bottom-3),new Point(r.Right-3,r.Bottom-3),new Point(r.Left+r.Width/2,r.Top+r.Height/2)})if(GetAncestor(WindowFromPoint(p),2)!=Handle)return false;return c.Enabled&&c.Visible;}
 void Read(){try{string line;while((line=Console.ReadLine())!=null){if(line.Length>4096)break;Dictionary<string,object> v;try{v=json.Deserialize<Dictionary<string,object>>(line);}catch{break;}
   if(nonce==null){if(!Exact(v,"nonce","id","command")||S(v,"command")!="init"||!GuidOk(S(v,"nonce"))||!GuidOk(S(v,"id")))break;nonce=S(v,"nonce");Interlocked.Exchange(ref heartbeat,Stopwatch.GetTimestamp());var initId=S(v,"id");new Thread(()=>{try{var handles=UI(()=>new[]{click.Handle,text.Handle,slider.Handle,list.Handle});var names=new[]{"click","type","slider","scroll"};var patterns=new[]{InvokePattern.Pattern,ValuePattern.Pattern,RangeValuePattern.Pattern,ScrollPattern.Pattern};var supported=new List<string>();for(int i=0;i<handles.Length;i++){object pattern;try{var el=AutomationElement.FromHandle(handles[i]);if(el.Current.ProcessId==Process.GetCurrentProcess().Id&&el.TryGetCurrentPattern(patterns[i],out pattern))supported.Add(names[i]);}catch{}}availableActions=supported.ToArray();Reply(initId,UI(()=>new{ready=hotkey}));}catch{Reply(initId,null,"uia-probe-failed");}}){IsBackground=true}.Start();continue;}
   if(S(v,"nonce")!=nonce)break;string command=S(v,"command");
   if(command=="heartbeat"){if(!Exact(v,"nonce","command"))break;Interlocked.Exchange(ref heartbeat,Stopwatch.GetTimestamp());continue;}
   string id=S(v,"id");if(!GuidOk(id))break;
   if(command=="observe"&&Exact(v,"nonce","id","command")){Reply(id,UI(()=>Observe()));continue;}
   if(command=="execute"&&Exact(v,"nonce","id","command","action","text","geometry","taskId","operationId","grantId","permission","policyVersion","sessionId","observationId","deadlineMs")){
    string a=S(v,"action"),t=S(v,"text"),g=S(v,"geometry"),task=S(v,"taskId"),op=S(v,"operationId"),grant=S(v,"grantId");if((a!="click"&&a!="type"&&a!="slider"&&a!="scroll")||t==null||t.Length>40||g==null||g.Length>1500||a!="type"&&t!=""||a=="type"&&String.IsNullOrWhiteSpace(t)||Array.Exists(t.ToCharArray(),c=>Char.IsControl(c))||!GuidOk(task)||!GuidOk(op)||!GuidOk(grant)||S(v,"permission")!="lab.control"||S(v,"sessionId")!=nonce||Convert.ToString(v["policyVersion"])!="1"||grants.Contains(grant)||operations.Contains(op)||tasks.Contains(task)||grants.Count>=32||S(v,"observationId")!=lastObservationId||Age(lastObservationStamp)>1000){Reply(id,null,"permission-denied");continue;}
    double deadline; if(!Double.TryParse(Convert.ToString(v["deadlineMs"]),out deadline)||Double.IsNaN(deadline)||Double.IsInfinity(deadline)||deadline<=Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency||deadline-Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency>30000){Reply(id,null,"permission-denied");continue;} UI(()=>{if(Array.IndexOf(availableActions,a)<0){Reply(id,null,"uia-unsupported-or-failed");return false;}if(busy||pendingId!=null){Reply(id,null,"busy");return false;}if(g!=Geometry()){Reply(id,null,"geometry-changed");return false;}grants.Add(grant);operations.Add(op);tasks.Add(task);pendingSince=Stopwatch.GetTimestamp();pendingDeadline=deadline;pendingId=id;pendingAction=a;pendingText=t;pendingGeometry=g;message.Text="CIC ขอทำ: "+a+(a=="type"?" → "+t:"")+"\nอ่านแล้วกดปุ่มสีเขียวเพื่อยืนยันหนึ่งครั้ง หรือหยุด";confirm.Enabled=true;return true;});continue;
   }
   Reply(id,null,"invalid");
  }}catch(Exception ex){Console.Error.WriteLine("reader-failed:"+ex.GetType().Name);}BeginInvoke((Action)Shutdown);}
 void RunPending(){if(pendingId==null||busy)return;var id=pendingId;var action=pendingAction;var value=pendingText;var geometry=pendingGeometry;pendingId=null;confirm.Enabled=false;var target=Target(action);
  if(Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency>=pendingDeadline||Age(pendingSince)>=30000||!OwnedForeground()||!VisibleTarget(target)||geometry!=Geometry()){Reply(id,null,"target-changed");message.Text="เป้าหมายเปลี่ยนหรือสิทธิ์หมดอายุ จึงไม่ได้ทำงาน กรุณาวางแผนใหม่";return;}
  var before=Observe();var stamp=Stopwatch.GetTimestamp();var handle=target.Handle;busy=true;
  // UIA on a background MTA thread keeps the owned-window UI/stop responsive.
  new Thread(()=>{string failure=null;try{
   if(!UI(()=>OwnedForeground()&&VisibleTarget(target)&&geometry==Geometry())||Age(stamp)>1000)throw new Exception("stale-observation");
   var element=AutomationElement.FromHandle(handle);if(element.Current.ProcessId!=Process.GetCurrentProcess().Id)throw new Exception("wrong-process");
   var p=element.GetCurrentPattern(action=="click"?InvokePattern.Pattern:action=="type"?ValuePattern.Pattern:action=="slider"?RangeValuePattern.Pattern:ScrollPattern.Pattern);
   if(Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency>=pendingDeadline||Age(stamp)>1000||!UI(()=>OwnedForeground()&&VisibleTarget(target)&&geometry==Geometry()))throw new Exception("stale-observation");
   if(action=="click")((InvokePattern)p).Invoke();
   else if(action=="type")((ValuePattern)p).SetValue(value);
   else if(action=="slider")((RangeValuePattern)p).SetValue(75);
   else ((ScrollPattern)p).Scroll(ScrollAmount.NoAmount,ScrollAmount.LargeIncrement);
   Thread.Sleep(80);
  }catch(Exception ex){failure=ex.Message=="stale-observation"||ex.Message=="wrong-process"?ex.Message:"uia-unsupported-or-failed";}
   try{UI(()=>{busy=false;message.Text=failure==null?"CIC ทำงานแล้ว · ตรวจผลในเว็บ":"ทำไม่สำเร็จ: "+failure;Reply(id,new{before=before,after=Observe()},failure);return true;});}catch{}
  }){IsBackground=true}.Start();
 }
 static bool Exact(Dictionary<string,object> v,params string[] keys){if(v.Count!=keys.Length)return false;foreach(var k in keys)if(!v.ContainsKey(k))return false;return true;}
 static string S(Dictionary<string,object> v,string key){object value;return v.TryGetValue(key,out value)?value as string:null;}
 static bool GuidOk(string v){Guid g;return Guid.TryParse(v,out g);}
 [STAThread] static void Main(){Console.OutputEncoding=new System.Text.UTF8Encoding(false);Console.InputEncoding=new System.Text.UTF8Encoding(false);try{if(!SetProcessDpiAwarenessContext(new IntPtr(-4))){Console.Error.WriteLine("dpi-context-unavailable");return;}Application.EnableVisualStyles();Application.Run(new CicLab());}catch(Exception ex){Console.Error.WriteLine("startup-failed:"+ex.GetType().Name);Environment.Exit(1);}}
}

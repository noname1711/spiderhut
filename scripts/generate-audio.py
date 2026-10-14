import wave
import numpy as np
from scipy.signal import butter, sosfilt
from pathlib import Path
p=Path('assets/audio');p.mkdir(exist_ok=True,parents=True)
fs=22050
rng=np.random.default_rng(220220)
def filt(a,lo=None,hi=None):
    if lo and hi: sos=butter(3,[lo,hi],btype='bandpass',fs=fs,output='sos')
    elif hi:sos=butter(3,hi,btype='lowpass',fs=fs,output='sos')
    elif lo:sos=butter(3,lo,btype='highpass',fs=fs,output='sos')
    else:return a
    return sosfilt(sos,a)
def write(name,a):
    a=np.asarray(a,dtype=np.float64)
    a=np.clip(a,-1,1)
    out=(a*32760).astype('<i2')
    with wave.open(str(p/name),'wb') as wf:
        wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(fs);wf.writeframes(out.tobytes())
    print(name, out.size)
def chirp(t,f0,f1,dur):
    phase=2*np.pi*(f0*t+(f1-f0)*t*t/(2*dur))
    return np.sin(phase)
for name, dur in [('web_spool.wav',.42),('web_lock.wav',.38),('web_tension.wav',.48),('stage_sting.wav',1.10)]:
    t=np.arange(int(fs*dur))/fs
    noise=rng.normal(0,1,len(t))
    if name=='web_spool.wav':
        env=np.exp(-9*t)*(1-np.exp(-t*170))
        s=.36*chirp(t,740,90,dur)*env+.23*filt(noise,250,3900)*env
    elif name=='web_lock.wav':
        env=np.exp(-16*t)*(1-np.exp(-t*220))
        s=.43*(np.sin(2*np.pi*125*t)+.2*np.sin(2*np.pi*260*t))*env+.16*filt(noise,140,2600)*env
    elif name=='web_tension.wav':
        env=(1-np.exp(-t*90))*np.exp(-7*t)
        s=.17*chirp(t,265,105,dur)*env+.15*filt(noise,120,1200)*env
    else:
        env=(1-np.exp(-9*t))*np.exp(-2.7*t)
        notes=[392,493.88,587.33]
        s=.16*sum(np.sin(2*np.pi*n*t)*env for n in notes)/3
    write(name,s)
# Distinct stage loops; carefully wrap last few hundred ms for seamless looping
length=9.0;N=int(length*fs);t=np.arange(N)/fs
baseNoise=rng.normal(0,1,N)
for stage in range(3):
    if stage==0:
        wash=filt(baseNoise,60,500)*.07
        waves=(np.sin(2*np.pi*.18*t)+.4*np.sin(2*np.pi*.36*t))*.075
        chimes=np.zeros(N)
        for ts in [1.2,4.7,7.1]:
            tt=t-ts;mask=tt>=0
            chimes+=mask*.09*np.sin(2*np.pi*(1650+200*np.exp(-np.maximum(tt,0)*3))*np.maximum(tt,0))*np.exp(-np.maximum(tt,0)*7)
        a=wash*(1+.45*waves)+chimes
    elif stage==1:
        wet=filt(baseNoise,480,6500)*.094
        deep=filt(rng.normal(size=N),70,300)*.07
        low=np.sin(2*np.pi*73*t)*.025*(.7+.3*np.sin(2*np.pi*.10*t))
        a=wet+deep+low
        for ts in (1.6,5.2,7.6):
            tt=t-ts;mask=tt>=0
            a+=mask*.036*np.sin(2*np.pi*510*np.maximum(tt,0))*np.exp(-np.maximum(tt,0)*9)
    else:
        wind=filt(baseNoise,80,1100)*.068
        river=filt(rng.normal(size=N),110,2000)*.038
        birds=np.zeros(N)
        for ts in (1.2,3.7,6.5):
            tt=t-ts;u=np.maximum(tt,0);mask=(tt>=0)&(tt<.8)
            birds+=mask*.09*np.sin(2*np.pi*(920*u+460*u*u))*(np.sin(np.pi*np.minimum(1,u/.8))**2)
        a=wind+river+birds
    # smoothing across loop boundary
    a=np.clip(a,-.35,.35)
    cross=int(fs*.35)
    a[:cross]=(a[:cross]*np.linspace(0,1,cross)+a[-cross:]*np.linspace(1,0,cross))
    write(f'ambient_stage_{stage+1}.wav',a)

# Romantic chapter BGM loops
rng2=np.random.default_rng(99117)
def tone(freq, t, kind='sine'):
    if kind=='triangle':
        return 2*np.abs(2*((freq*t)%1)-1)-1
    if kind=='softsquare':
        return np.tanh(2.2*np.sin(2*np.pi*freq*t))
    return np.sin(2*np.pi*freq*t)
def adsr(tt, attack=.02, decay=.18, sustain=.55, release=.22, dur=1.0):
    out=np.zeros_like(tt)
    a=tt<attack
    out[a]=tt[a]/max(attack,1e-6)
    d=(tt>=attack)&(tt<attack+decay)
    out[d]=1-(1-sustain)*((tt[d]-attack)/max(decay,1e-6))
    s=(tt>=attack+decay)&(tt<dur-release)
    out[s]=sustain
    r=(tt>=dur-release)&(tt<dur)
    out[r]=sustain*(1-(tt[r]-(dur-release))/max(release,1e-6))
    return out

def add_note(arr,start,dur,freq,amp=.2,kind='sine',overtones=(1,.35,.15)):
    i0=int(start*fs); i1=min(len(arr), int((start+dur)*fs))
    if i0>=len(arr) or i1<=i0: return
    tt=np.arange(i1-i0)/fs
    env=adsr(tt,dur=dur)
    sig=np.zeros_like(tt)
    for idx,ov in enumerate(overtones, start=1):
        sig += ov*tone(freq*idx,tt,kind)
    sig/=sum(overtones)
    arr[i0:i1]+=amp*sig*env

def chord_track(length, chord_prog, step=1.5, amp=.10, kind='triangle'):
    N=int(length*fs); arr=np.zeros(N)
    for n,ch in enumerate(chord_prog):
        start=n*step
        for f in ch:
            add_note(arr,start,step*1.02,f,amp,kind,overtones=(1,.22,.08))
    return arr

def arpeggio_track(length, notes, pattern, step=.375, amp=.11, kind='sine'):
    N=int(length*fs); arr=np.zeros(N)
    total=int(length/step)
    for n in range(total):
        note=notes[pattern[n%len(pattern)] % len(notes)]
        add_note(arr,n*step,step*.95,note,amp,kind,overtones=(1,.12,.04))
    return arr

def pad_from_chords(length, chord_prog, step=1.5, amp=.07):
    N=int(length*fs); arr=np.zeros(N)
    for n,ch in enumerate(chord_prog):
        start=n*step; dur=step*1.15
        for f in ch[:3]: add_note(arr,start,dur,f/2,amp,'sine',overtones=(1,.06,.03))
    return filt(arr,hi=1800)

music_len=12.0
chords1=[[261.63,329.63,392.00],[220.00,329.63,440.00],[246.94,349.23,392.00],[196.00,293.66,392.00],[261.63,329.63,392.00],[220.00,329.63,440.00],[174.61,261.63,392.00],[196.00,293.66,392.00]]
bgm1=pad_from_chords(music_len,chords1,1.5,.075)+arpeggio_track(music_len,[523.25,659.25,783.99,880.00],[0,1,2,1,0,2,3,2],.375,.060,'triangle')
for ts in [2.7,5.8,8.8,10.8]: add_note(bgm1,ts,.55,1174.66,.06,'sine',overtones=(1,.1,.03))
chords2=[[220.00,261.63,329.63],[196.00,246.94,392.00],[174.61,261.63,349.23],[196.00,293.66,392.00],[220.00,261.63,329.63],[164.81,246.94,329.63],[174.61,261.63,349.23],[146.83,220.00,293.66]]
bgm2=pad_from_chords(music_len,chords2,1.5,.08)+chord_track(music_len,[[n*2 for n in c] for c in chords2],1.5,.04,'softsquare')
for n,ts in enumerate(np.arange(0,12,.75)):
    seq=[329.63,392.00,440.00,392.00,349.23,329.63,293.66,261.63]
    add_note(bgm2,float(ts),.42,seq[n%len(seq)],.055,'sine',overtones=(1,.08,.03))
chords3=[[293.66,369.99,440.00],[246.94,369.99,493.88],[261.63,392.00,523.25],[220.00,329.63,440.00],[293.66,369.99,440.00],[246.94,392.00,493.88],[220.00,349.23,440.00],[196.00,329.63,392.00]]
bgm3=pad_from_chords(music_len,chords3,1.5,.07)+arpeggio_track(music_len,[587.33,739.99,880.00,987.77],[0,1,2,3,2,1],.30,.05,'triangle')
for ts in [1.5,4.5,7.5,10.5]: add_note(bgm3,ts,.70,1318.51,.05,'sine',overtones=(1,.08,.02))
for idx,a in enumerate([bgm1,bgm2,bgm3], start=1):
    a=filt(a,hi=2400)
    a+=filt(rng2.normal(0,1,len(a)),hi=600)*.005
    a=np.clip(a,-.30,.30)
    cross=int(fs*.45)
    a[:cross]=(a[:cross]*np.linspace(0,1,cross)+a[-cross:]*np.linspace(1,0,cross))
    write(f'bgm_stage_{idx}.wav',a)

Server = {
	npc: [],
	objects: [],
	Vars: {
		red_npc_count: {
			def: 20,
			value: 20,
			min: 0
		},
		red_npc_healthmodifier: {
			def: 1.0,
			value: 1.0,
			min: 0.01,
			max: 10.0
		},
		green_npc_count: {
			def: 10,
			value: 10,
			min: 1
		},
		green_npc_healthreg: {
			def: 5,
			value: 5,
			min: 0
		},
		dot_max_speed: {
			def: 0.15,
			value: 0.15,
			min: 0.01,
			max: 0.3
		},
		gamemode: {
		
		},
		max_cmdrate: {
			def: 100,
			value: 100,
			min: 33
		},
		max_msgrate: {
			def: 2,
			value: 2,
			min: 1
		},
		kick_delay: {
			def: 5000,
			value: 5000,
			min: 2000
		}
		
	},
	
	setVar: function(key, value) {
		if (this.Vars[key]) {
			if ((this.Vars[key].min === undefined || value >= this.Vars[key].min) && (this.Vars[key].max === undefined || value <= this.Vars[key].max)) {
				this.Vars[key].value = value;
				return true;
			}
		}
		return false;
	},
	getVar: function(key) {
		if (this.Vars[key]) {
			return this.Vars[key];
		}
		return false;
	},
}
SO = {
	Dot: function(){
		this.x;
		this.y;
		
		this.hp;
		
		this.lastShoot;
	},
	RedDot: function(){
		this.x;
		this.y;
		this.lastShoot;
	},
	GreenDot: function(){
		this.x;
		this.y;
	},
	Shot: function(){
		this.x;
		this.y;
	},
	Player: function(socket) {
		this.socket = socket;
		this.cmdrate = 0;
		this.msgrate = 0;
		this.msgTimeout = false;
		
		this.connected = true;
		this.recievedHeartbeat = true;
		this.lastHeartbeat = 0;
		this.kickFlag = false;
		this.verified = false;
		
		this.timeOnServer = 0;
		this.username;
		this.level = 1;
		this.kills = 0;
		
		this.dot = new SO.Dot();
	},
}

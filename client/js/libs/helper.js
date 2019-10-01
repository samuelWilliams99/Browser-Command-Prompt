define({
	removeByValue: function(arr, val) {
		for(let k in arr){
			if(arr[k] == val) {
				delete arr[k];
				return true;
			}
		}
		return false;
	},
	hasValue: function(arr, val) {
		arr.indexOf(val) != -1;
	}
})
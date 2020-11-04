"use strict";


const cache = require('./cache.js');

const custom_select_element = {

	// TODO: set proper table icons URL
	table_icons_base_path: '',
	table_icons_extension: '',
	cache_bucket_name: 'select_elements',


	// generators
	new_select_html(select_data, custom_select_type, use_cached=false){

		const {
			select_type = 'simple',
			select_name = '',
			select_label = '',
			select_table = '',
			select_groups_data = []
		} = select_data;


		//making a copy of payload with all options enabled
		const select_data_copy = JSON.parse(JSON.stringify(select_data));
		for(const [group_name, group_data] of Object.entries(select_data_copy['select_groups_data']))
			for(const option_name of Object.keys(group_data['select_options_data']))
				select_data_copy['select_groups_data'][group_name]['select_options_data'][option_name]['is_enabled'] = false;
		const cache_key = JSON.stringify([custom_select_type,select_data_copy]);

		if(cache_key && use_cached) {
			const data = cache.get(custom_select_element.cache_bucket_name, cache_key);
			if(data)
				return data;
		}

		let default_name = 0;
		let header = '';
		let preview = '';
		let first_row = '';
		let is_relationship_text = 'false';
		let groups_html = '';

		//find if there is any value checked
		let default_label = 0;
		let default_icon = '';
		let is_relationship = false;
		let table_name = '';
		outer_loop:
			for (const select_group_data of select_groups_data)
				for (const select_field_data of select_group_data['select_options_data'])
					if (select_field_data.is_default) {
						({
							option_name: default_label,
							option_value: default_name,
							is_relationship,
							table_name
						} = select_field_data);
						break outer_loop;
					}

		if (custom_select_type==='opened_list') {
			header = `
				<span class="custom_select_header">
					<span class="custom_select_header_icon">
						` + custom_select_element.icon(true, true, select_table) + `
					</span>
					<span class="custom_select_table_label">
						` + select_label + `
					</span>
				</span>`;

		} else {

			if (default_label !== 0)
				default_icon = custom_select_element.icon(is_relationship, true, table_name);

			is_relationship_text = is_relationship.toString();

			preview = `<span class="custom_select_input" tabindex="0">
							<span class="custom_select_input_icon">` + default_icon + `</span>
							<span class="custom_select_input_label">` + default_label + `</span>
						</span>`;

			if(custom_select_type==='closed_list' && select_type !== 'to_many')
				first_row = custom_select_element.new_select_option_html({
					option_name: '',
					option_value: '0',
					is_enabled: true,
					is_relationship: false,
					is_default: default_label === 0,
					table_name: ''
				});

		}

		if(custom_select_type!=='preview_list')
			groups_html = select_groups_data.map(
					select_group_data => custom_select_element.new_select_group_html(select_group_data)
				).join('');


		const result = `<span
				class="custom_select"
				title="` + select_label + `"
				data-name="` + select_name + `"
				data_value_is_relationship="` + is_relationship_text + `"
				data-value="` + default_name + `"
				data-previous_value="0"
				data-table="` + select_table + `"
				data-mapping_type="` + select_type + `"
				data-type="`+custom_select_type+`">
			` + header + `
			` + preview + `
			<span class="custom_select_options">
				` + first_row
				  + groups_html
				+ `
			</span>
		</span>`;

		if(cache_key)
			cache.set(custom_select_element.cache_bucket_name,cache_key,result);

		return result;

	},

	new_select_group_html(select_group_data){

		const {
			select_group_name,
			select_group_label,
			select_options_data
		} = select_group_data;

		return `<span
					class="custom_select_group"
					data-group="` + select_group_name + `">
			<span class="custom_select_group_label">` + select_group_label + `</span>
			` + (select_options_data.map(select_option_data => custom_select_element.new_select_option_html(select_option_data)).join('')) + `
		</span>`;

	},

	new_select_option_html(select_option_data){

		const {
			option_name,
			option_value,
			is_enabled = true,
			is_relationship = false,
			is_default = false,
			table_name = ''
		} = select_option_data;

		const classes = ['custom_select_option'];

		if (!is_enabled && !is_relationship) //don't disable relationships
			classes.push('custom_select_option_disabled');

		if (is_relationship)
			classes.push('custom_select_option_relationship');

		if (is_default)
			classes.push('custom_select_option_selected');


		return `<span
					class="` + (classes.join(' ')) + `"
					data-value="` + option_value + `"
					data-table_name="` + table_name + `"
					tabindex="0">
			<span class="custom_select_option_icon">` + custom_select_element.icon(is_relationship, is_default, table_name) + `</span>
			<span class="custom_select_option_label">` + option_name + `</span>
		</span>`;
	},

	icon(is_relationship, is_default, table_name){
		if (is_relationship && table_name !== '') {
			//TODO: enable table icons once ready
			//'<img src="' + custom_select_element.table_icons_base_path + table_name + custom_select_element.table_icons_extension + '" alt="' + table_name + '">


			const table_sub_name = table_name.substr(0, 2);
			const color_hue = ((table_sub_name[0].charCodeAt(0) + table_sub_name[1].charCodeAt(0)) - ('a'.charCodeAt(0) * 2)) * 7.2;
			const color = 'hsl(' + color_hue + ', 100%, 50%)';
			return '<span style="color:' + color + '">' + (table_sub_name.toUpperCase()) + '</span>';
		} else
			return '';
	},


	// loading
	set_event_listeners(container, change_callback){
		container.addEventListener('click', e => {

			const el = e.target;

			//toggle list options
			if (el.closest('.custom_select_input') !== null) {
				const select_container = el.closest('.custom_select');
				if (select_container.classList.contains('custom_select_open'))
					select_container.classList.remove('custom_select_open');
				else {
					select_container.classList.add('custom_select_open');

					// scroll the list down to selected option
					const selected_options = custom_select_element.get_selected_options(select_container);
					if(selected_options.length !== 0){
						const selected_option = selected_options[0];
						const options_container = select_container.getElementsByClassName('custom_select_options')[0];

						if(  // scroll down if
							options_container.scrollTop === 0 && // the list is not already scrolled
							options_container.offsetHeight < selected_option.offsetTop + selected_option.offsetHeight // and selected item is not visible
						)
							options_container.scrollTop = selected_option.offsetTop - selected_option.offsetHeight;

					}
				}
			}

			//close opened lists
			const lists = container.getElementsByClassName('custom_select');
			const current_list = el.closest('.custom_select');

			for (const list of lists)
				if (list !== current_list)  //dont close current list
					list.classList.remove('custom_select_open');

			//recalculate width of each object
			//custom_select_element.resize_elements(lists);

			if (current_list !== null) {

				//check if option was changed
				const custom_select_option = el.closest('.custom_select_option');
				if (custom_select_option !== null) {

					const change_payload = custom_select_element.change_selected_option(current_list, custom_select_option);
					current_list.classList.remove('custom_select_open');

					if (typeof change_payload === "object")
						change_callback(change_payload);

				}

			}

		});
	},

	onload(container){

		const lists = container.getElementsByClassName('custom_select');
		custom_select_element.resize_elements(lists);

	},

	resize_elements(lists){
		new Promise((resolve)=>{
			resolve();

			for (const list of lists) {
				const list_input = list.getElementsByClassName('custom_select_input')[0];

				if (typeof list_input === "undefined")
					continue;

				const list_value = custom_select_element.get_list_value(list);
				let width = cache.get('custom_select_width',list_value);

				if(width===false){
					const list_options = list.getElementsByClassName('custom_select_options')[0];
					if(typeof list_options === "undefined")
						continue;

					width = list_options.offsetWidth;
				}

				list.style.setProperty('--base_width',  width+ 'px');

				cache.set('custom_select_width',list_value,width,{
					bucket_type: 'session_storage',
				})
			}
		});
	},


	// helpers
	change_selected_option(target_list, target_option){

		//if target_option is option's name, find option element
		if(typeof target_option === 'string'){
			target_option = custom_select_element.find_option_by_name(target_list, target_option);
			if(target_option===null)
				return;
		}

		//ignore selected and disabled elements
		if (target_option.classList.contains('custom_select_option_selected') || target_option.classList.contains('custom_select_option_disabled')) {
			target_list.classList.add('custom_select_open');
			return;
		}

		//unselect all options
		for (const selected_line of target_list.querySelectorAll('.custom_select_option_selected'))
			selected_line.classList.remove('custom_select_option_selected');

		//extract data about new option
		const custom_select_option_value = custom_select_element.get_option_value(target_option);
		const custom_select_option_label_element = target_option.getElementsByClassName('custom_select_option_label')[0];
		const custom_select_option_label = custom_select_option_label_element.textContent;

		let previous_list_value = custom_select_element.get_list_value(target_list);
		const previous_previous_value = target_list.getAttribute('data-previous_value');

		//don't change values if new value is 'add'
		const list_type = custom_select_element.get_list_mapping_type(target_list);

		//don't do anything if value wasn't changed
		if (custom_select_option_value === previous_list_value)
			return false;

		//update list data
		const is_relationship = target_option.classList.contains('custom_select_option_relationship');

		target_list.setAttribute('data_value_is_relationship', is_relationship.toString());
		target_list.setAttribute('data-value', custom_select_option_value);
		target_list.setAttribute('data-previous_value', previous_list_value);
		target_option.classList.add('custom_select_option_selected');


		//update custom_select_input
		const custom_select_inputs = target_list.getElementsByClassName('custom_select_input');

		if (custom_select_inputs.length !== 0) {

			const custom_select_input = custom_select_inputs[0];
			const table_name = target_option.getAttribute('data-table_name');

			const custom_select_input_icon = custom_select_input.getElementsByClassName('custom_select_input_icon')[0];
			custom_select_input_icon.innerHTML = custom_select_element.icon(is_relationship, true, table_name);

			const custom_select_input_label = custom_select_input.getElementsByClassName('custom_select_input_label')[0];
			custom_select_input_label.innerText = custom_select_option_label;

		}


		const custom_select_type = target_list.getAttribute('data-type');
		const list_table_name = custom_select_element.get_list_table_name(target_list);
		return {
			changed_list: target_list,
			selected_option: target_option,
			new_value: custom_select_option_value,
			previous_value: previous_list_value,
			previous_previous_value: previous_previous_value,
			is_relationship: is_relationship,
			list_type: list_type,
			custom_select_type: custom_select_type,
			list_table_name: list_table_name,
		};

	},

	add_option(list, position, option_data, selected = false){

		const new_option_line_html = custom_select_element.new_select_option_html(option_data);
		let new_option_line = document.createElement('span');

		const option_container = list.getElementsByClassName('custom_select_options')[0].getElementsByClassName('custom_select_group')[0];

		const options = option_container.children;

		if (position < -1)
			position = options.length + 1 + position;

		if (position >= options.length)
			option_container.appendChild(new_option_line);
		else
			option_container.insertBefore(new_option_line, options[position]);

		new_option_line.outerHTML = new_option_line_html;
		new_option_line = options[position];

		if (selected)
			custom_select_element.change_selected_option(list, new_option_line);

	},

	enable_disabled_options(list){

		const options = list.getElementsByClassName('custom_select_option');

		for (const option of options)
			option.classList.remove('custom_select_option_disabled');

	},

	toggle_option(list, option_name, action){

		//don't do anything if seeking for the default option
		if(option_name === '0')
			return;

		const options = Object.values(list.getElementsByClassName('custom_select_option'));
		const option = options.filter(option=>
			option.getAttribute('data-value')===option_name
		)[0];

		//don't do anything if can't find the requested option
		if(typeof option === "undefined")
			return;

		if (action === 'enable')
			option.classList.remove('custom_select_option_disabled');

		//dont disable relationships
		else if (action === 'disable' && !option.classList.contains('custom_select_option_relationship'))
			option.classList.add('custom_select_option_disabled');

	},


	// getters
	find_option_by_name(list, option_name){
		return list.querySelector('.custom_select_option[data-value="'+option_name+'"]');
	},

	get_selected_options: list =>
		list.getElementsByClassName('custom_select_option_selected'),

	is_selected_option_enabled(list){

		const options = custom_select_element.get_selected_options(list);

		for (const option of options)
			if(option.classList.contains('custom_select_option_selected'))
				return !option.classList.contains('custom_select_option_disabled');

		return true;

	},

	get_option_value: option_element =>
		option_element.getAttribute('data-value'),

	get_list_value: list_element =>
		list_element.getAttribute('data-value'),

	get_list_table_name: list_element =>
		list_element.getAttribute('data-table'),

	get_list_mapping_type: list_element =>
		list_element.getAttribute('data-mapping_type'),

	element_is_relationship: element =>
		element.getAttribute('data_value_is_relationship') === 'true',

};

module.exports = custom_select_element;
﻿var LiveChart = function (config)
{
	//Required for inheritence.
	if (!config) return;

	this.config = config;
	this.shift = false;
};

window.chartCreated = false;

LiveChartConfig = function (params)
{
	params = params || {};
	this.painted = false;
	this.renderTo = params['renderTo'] || 'live_chart_div';
	this.renderHeight = params['renderHeight'] || 450;
	this.shift = typeof params['shift'] !== 'undefined' ? params['shift'] : 1;
	this.with_trades = typeof params['with_trades'] !== 'undefined' ? params['with_trades'] : 1;
	this.ticktrade_chart = typeof params['ticktrade_chart'] !== 'undefined' ? params['ticktrade_chart'] : 0;
	this.with_marker = typeof params['with_marker'] !== 'undefined' ? params['with_marker'] : 0;
	this.contract_start_time = typeof params['contract_start_time'] !== 'undefined' ? params['contract_start_time'] : 0;
	this.how_many_ticks = typeof params['how_many_ticks'] !== 'undefined' ? params['how_many_ticks'] : 0;
	this.with_tick_config = typeof params['with_tick_config'] !== 'undefined' ? params['with_tick_config'] : 0;
	this.with_entry_spot = typeof params['with_entry_spot'] !== 'undefined' ? params['with_entry_spot'] : 0;

	this.indicators = [];
	this.resolutions = {
		'tick': { seconds: 0, interval: 3600 },
		'M1': { seconds: 60, interval: 86400 },
		'M5': { seconds: 300, interval: 7 * 86400 },
		'M30': { seconds: 1800, interval: 31 * 86400 },
		'H1': { seconds: 3600, interval: 62 * 86400 },
		'H8': { seconds: 8 * 3600, interval: 183 * 86400 },
		'D': { seconds: 86400, interval: 366 * 3 * 86400 }
	};
	this.resolution = 'tick';
	this.with_markers = typeof params['with_markers'] !== 'undefined' ? params['with_markers'] : false;
};

LiveChartConfig.prototype = {
	add_indicator: function (indicator)
	{
		this.indicators.push(indicator);
	},
	remove_indicator: function (name)
	{
		var deleted_indicator;
		var indicator = this.indicators.length;
		while (indicator--)
		{
			if (this.indicators[indicator].name == name)
			{
				deleted_indicator = this.indicators[indicator];
				this.indicators.splice(indicator, 1);
			}
		}
		return deleted_indicator;
	},
	has_indicator: function (name)
	{
		var indicator = this.indicators.length;
		while (indicator--)
		{
			if (this.indicators[indicator].name == name)
			{
				return true;
			}
		}
		return false;
	},
	repaint_indicators: function (chart)
	{
		var indicator = this.indicators.length;
		while (indicator--)
		{
			this.indicators[indicator].repaint(chart);
		}
	},
	calculate_from: function (len)
	{
		var now = new Date();
		var epoch = Math.floor(now.getTime() / 1000);
		var units = { min: 60, h: 3600, d: 86400, w: 86400 * 7, m: 86400 * 31, y: 86400 * 366 };
		var res = len.match(/^([0-9]+)([hdwmy]|min)$/);

		return res ? epoch - parseInt(res[1]) * units[res[2]] : undefined;
	},
	update: function (opts)
	{
		if (opts.interval)
		{
			var from = parseInt(opts.interval.from.getTime() / 1000);
			var to = parseInt(opts.interval.to.getTime() / 1000);
			var length = to - from;
			this.resolution = this.best_resolution(from, to);
			delete opts.interval;
			this.from = from;
			this.to = to;
			delete this.live;
		}
		if (opts.live)
		{
			delete this.to;
			LocalStore.remove('live_chart.to');
			LocalStore.remove('live_chart.from');
			this.from = this.calculate_from(opts.live);
			this.live = opts.live;
			LocalStore.set('live_chart.live', opts.live);
			this.resolution = this.best_resolution(this.from, new Date().getTime() / 1000);
		}
		if (opts.symbol)
		{
			var symbol = markets.by_symbol(opts.symbol);
			if (symbol)
			{
				this.symbol = symbol.underlying;
				this.market = symbol.market;
				LocalStore.set('live_chart.symbol', symbol.symbol);
			}
		}

		if (opts.update_url)
		{
			var hash = "#";

			if (this.from && this.to)
			{
				hash += this.symbol.symbol + ":" + this.from + "-" + this.to;
			} else
			{
				hash += this.symbol.symbol + ":" + this.live;
			}

			var url = window.location.pathname + window.location.search + hash;
			page.url.update(url);
		}
		if (opts.shift)
		{
			this.shift = opts.shift;
		}
		if (opts.with_trades)
		{
			this.with_trades = opts.with_trades;
		}
		if (opts.with_markers)
		{
			this.with_markers = opts.with_markers;
		}
	},
	best_resolution: function (from, to)
	{
		var length = parseInt(to - from);
		for (var resolution in this.resolutions)
		{
			if (this.resolutions[resolution].interval >= length)
			{
				return resolution;
			}
		}
		return '1d';
	},
	resolution_seconds: function (resolution)
	{
		resolution = typeof resolution !== 'undefined' ? resolution : this.resolution;
		return this.resolutions[resolution]['seconds'];

	},
};

LiveChart.prototype = {
	close_chart: function ()
	{
		this.chart.destroy();
	},
	show_chart: function ()
	{
		this.chart = new Highcharts.StockChart(this.chart_params());
		this.chart.showLoading();
		window.CurrentChart.chart = new Highcharts.StockChart(this.chart_params());
	},
	add_indicator: function (indicator)
	{
		this.config.add_indicator(indicator);
		indicator.paint(this);
	},
	remove_indicator: function (indicator)
	{
		//var indicator = this.config.remove_indicator(name);
		//if (indicator)
		//{
		indicator.remove(this);
		//}
	},
	repaint_indicator: function (name)
	{
		if (indicator)
		{
			indicator.repaint(this);
		}
	},
	exporting_menu: function ()
	{
		var $self = this;
		var menuItems = [];

		var defaultOptions = Highcharts.getOptions();
		var defaultMenu = defaultOptions.exporting.buttons.contextButton.menuItems;
		for (var i = 0; i < defaultMenu.length; i++)
		{
			menuItems.push(defaultMenu[i]);
		}

		return menuItems;
	},
	process_contract: function (trade)
	{
	},
	chart_params: function ()
	{
		var $self = this;
		var chart_params =
		{
			chart:
			{
				height: this.config.renderHeight,
				renderTo: this.config.renderTo,
				events:
				{
					load: function ()
					{
						window.chartCreated = true;
						var me = this;
						Binary.Api.Client.account.statement(function (statement_data)
						{
							me.addSeries(
							{
								id: 'eventFlagsSeries',
								type: 'flags',
								onSeries: 'primary_series',
								shape: 'circlepin'
							}, true);
							var dat = [];
							for (var i in statement_data.transactions)
							{
								var obj =
								{
									x: statement_data.transactions[i].transaction_time * 1000,
									title: 'C',
									text: statement_data.transactions[i].amount
								};
								if (me.get('primary_series').points[0].x < obj.x)
									dat.push(obj);
							};
							me.get('eventFlagsSeries').setData(dat);
							if (!(Binary.Mediator.events.symbolchanged.listeners))
								Binary.Mediator.on('symbolChanged', function ()
								{
									updateInstrument(window.CurrentChart, window.CurrentChart.config, Ext.getCmp('ext_Symbol_market').getValue())
								});
						});
					}
				}
			},
			credits:
			{
				enabled: false
			},
			exporting:
			{
				buttons:
				{
					contextButton:
					{
						menuItems: this.exporting_menu()
					}
				},
				enabled: true
			},
			plotOptions:
			{
				series:
				[{
					id: 'dataseries',
					animation: false,
					dataGrouping:
					{
						dateTimeLabelFormats:
						{
							millisecond: ['%A, %b %e, %H:%M:%S.%L GMT', '%A, %b %e, %H:%M:%S.%L', '-%H:%M:%S.%L GMT'],
							second: ['%A, %b %e, %H:%M:%S GMT', '%A, %b %e, %H:%M:%S', '-%H:%M:%S GMT'],
							minute: ['%A, %b %e, %H:%M GMT', '%A, %b %e, %H:%M', '-%H:%M GMT'],
							hour: ['%A, %b %e, %H:%M GMT', '%A, %b %e, %H:%M', '-%H:%M GMT'],
							day: ['%A, %b %e, %Y', '%A, %b %e', '-%A, %b %e, %Y'],
							week: ['Week from %A, %b %e, %Y', '%A, %b %e', '-%A, %b %e, %Y'],
							month: ['%B %Y', '%B', '-%B %Y'],
							year: ['%Y', '%Y', '-%Y']
						},
						turboThreshold: 3000
					},
					marker: {
						enabled: false//this.config.with_markers,
						//radius: 2,
					},
				}],
				candlestick:
				{
					turboThreshold: 3000
				}
			},
			xAxis:
			{
				type: 'datetime',
				//min: this.config.from * 1000,
			},
			yAxis:
			{
				labels:
				{
					formatter: function () { return this.value; }
				},
				title:
				{
					text: null
				}
			},
			rangeSelector:
			{
				enabled: false,
			},
			title:
			{
				//text: this.config.symbol,// TODO: add real symbol name as translated_display_name()
			}
		};

		if (this.config.with_marker)
		{
			chart_params.plotOptions.line = { marker: { enabled: true } };
		}

		if (this.config.with_tick_config)
		{
			chart_params.chart.width = 401;
			chart_params.chart.height = 112;
			chart_params.navigator = { enabled: false };
			chart_params.scrollbar = { enabled: false };
			chart_params.title = '';
			chart_params.exporting.enabled = false;
			chart_params.exporting.enableImages = false;
		}
		if (this.config.with_tick_config)
		{

		}
		this.configure_series(chart_params);
		return chart_params;
	},
	process_message: function (message, livechart)
	{
		var data = message;
		if (data.error)
		{
			this.ev.close();
			return;
		}
		if (data.notice)
		{
			$("#" + data.notice + "_notice").show();
			return;
		}
		if (!(data[0] instanceof Array))
		{
			data = [data];
		}

		var data_length = data.length;
		for (var i = 0; i < data_length; i++)
		{
			this.process_data(data[i]);
		}

		if (data_length > 0 && this.spot)
		{
			if (this.config.chartType == "ticks" && this.config.repaint_indicators)
				this.config.repaint_indicators(this);//temp
			this.chart.redraw();
			if (!this.config.ticktrade_chart && !this.navigator_initialized)
			{
				this.navigator_initialized = true;
				var xData = this.chart.series[0].xData;
				var xDataLen = xData.length;
				if (xDataLen)
				{
					this.chart.xAxis[0].setExtremes(xData[0], xData[xDataLen - 1], true, false);
				}
			}
			this.chart.hideLoading();
			this.config.painted = true;
			this.shift = this.config.shift == 1 ? true : false;
		}
	},
	update_interval: function (min, max)
	{
		this.chart.xAxis[0].setExtremes(
			min || minDT,
			max || new Date().getTime()
		)
	}
};

window.CurrentChart = {};
createChart = function (symbol_, chartType_, granularity_)
{
	var live_chart;
	var chart_closed;
	var ticks_array = [];

	function updateLiveChart(config, data)//create new chart with data or update existing
	{
		if (live_chart)
		{
			if ((live_chart.config.chartType != config.chartType) || (live_chart.config.granularity != config.granularity) || (live_chart.config.resolution != config.resolution) || (live_chart.config.symbol != config.symbol))
			{
				live_chart.close_chart();
				live_chart = null;
				window.chartCreated = false;
			}
		};
		if (!window.chartCreated)
		{
			if (config.resolution == 'tick')
			{
				live_chart = new LiveChartTick(config);
				window.CurrentChart = live_chart;
			}
			else
			{
				live_chart = new LiveChartOHLC(config);
				window.CurrentChart = live_chart;
			};
			window.CurrentChart.chart = {};
			live_chart.show_chart();

			live_chart.process_message(data, live_chart);
		}
		else
		{
			live_chart.update_data(data, live_chart);
		}
		$("#show_spot").show();
		chart_closed = false;
	}

	var minDT = new Date();
	minDT.setUTCFullYear(minDT.getUTCFullYear - 3);
	var liveChartsFromDT, liveChartsToDT, liveChartConfig = {};

	changeResolution = function (res)
	{
		var chartToShow = live_chart;
		chartToShow.chart.showLoading();
		liveChartConfig.painted = false;
		Binary.Api.Client.unsubscribeAll();
		globalConfig.granularity = res;
		window.chartCreated = false;
		var displayChartType = globalConfig.chartType;

		if ((res != 'M10' && res != 'M30' && res != 'M60') && (globalConfig.chartType == 'ticks'))
		{
			displayChartType = 'closing';
			var requestChartType = 'candles';
		}
		else
		{
			displayChartType = globalConfig.chartType;
			if (globalConfig.chartType == 'ticks')
				var requestChartType = 'ticks';
			else var requestChartType = 'candles';
		}

		Binary.Api.Client.symbols(
			function (symbols_data)
			{
				init_live_chart(symbols_data, globalConfig.symbol, displayChartType, globalConfig.granularity);
				chartToShow.chart.hideLoading();
			},
			globalConfig.symbol,
			requestChartType,
			res);
	};

	var show_chart_for_instrument = function (data, symbol, chartType, granularity) //changed
	{
		var disp_symb;
		if (symbol && chartType)
		{
			liveChartConfig.chartType = chartType;
			liveChartConfig.symbol = symbol;
			liveChartConfig.granularity = granularity;
			(liveChartConfig.chartType == 'ticks') ? liveChartConfig.resolution = 'tick' : liveChartConfig.resolution = 'ohlc';
			liveChartConfig.renderTo = 'LiveChart_container';
			liveChartConfig.renderHeight = 300;

			liveChartConfig.live = 500;

			liveChartConfig.resolution_seconds = 1000;// for ohlc only

			updateLiveChart(liveChartConfig, data);
		}
	};

	updateInstrument = function (live_chart, liveChartConfig, value)
	{
		if (liveChartConfig.symbol != value)
		{
			var chartToShow = live_chart;
			try { chartToShow.chart.showLoading(); } catch (e) { };
			liveChartConfig.painted = false;
			window.chartCreated = false;
			var displayChartType = globalConfig.chartType;

			if ((globalConfig.granularity != 'M10' && globalConfig.granularity != 'M30' && globalConfig.granularity != 'M60') && (globalConfig.chartType == 'ticks'))
			{
				displayChartType = 'closing';
				var requestChartType = 'candles';
			}
			else
			{
				displayChartType = globalConfig.chartType;
				if (globalConfig.chartType == 'ticks')
					var requestChartType = 'ticks';
				else var requestChartType = 'candles';
			}

			globalConfig.symbol = value;
			Binary.Api.Client.unsubscribeAll();
			Binary.Api.Client.symbols(function (symbols_data)
			{
				chartToShow.chart.hideLoading();
				init_live_chart(symbols_data, globalConfig.symbol, displayChartType, globalConfig.granularity);
			},
			globalConfig.symbol,
			requestChartType,
			globalConfig.granularity);
		}
	}

	var build_contractCategory_select = function ()
	{
		var contractCategory_select = $("#contractCategory_select");
		$("#contractCategory_spant").hide();
		if (Binary.Markets)
		{
			$("#contractCategory_select option").remove();
			contractCategory_select.append("<option class='deleteme'></option>");
			$.each(Binary.Markets["0"].contract_categories, function (index, value)
			{
				//TODO: fix index to be a string value
				if (this)
					$.each(this, function ()
					{
						contractCategory_select.append("<option value='" + index + "'>" + index + ": " + this + "</option>");
					});
			});
			$("#contractCategory_span").show();
			$("#contractCategory_select").change(function ()
			{
				//globalConfig.symbol = $("#instrument_select").val();
				//Binary.Api.Client.symbols(function (symbols_data)
				//{
				//	init_live_chart(symbols_data, globalConfig.symbol, globalConfig.chartType);
				//},
				//Binary.Api.Intervals.Once,
				//globalConfig.symbol,
				//globalConfig.chartType);
			});
		}
	};
	function updateChartType(value)
	{
		var chartToShow = live_chart;
		var needHideLoading = true;
		try { chartToShow.chart.showLoading(); } catch (e) { };
		liveChartConfig.painted = false;
		window.chartCreated = false;

		var usedChartType = 'ticks';
		globalConfig.chartType = value;
		if (globalConfig.chartType != 'ticks' && globalConfig.chartType)
			usedChartType = 'candles';

		var displayChartType = globalConfig.chartType;

		if ((globalConfig.granularity != 'M10' && globalConfig.granularity != 'M30' && globalConfig.granularity != 'M60') && (globalConfig.chartType == 'ticks'))
		{
			displayChartType = 'closing';
			var usedChartType = 'candles';
		}
		else
		{
			displayChartType = globalConfig.chartType;
			if (globalConfig.chartType == 'ticks')
				var usedChartType = 'ticks';
			else var usedChartType = 'candles';
		}

		Binary.Api.Client.unsubscribeAll();
		Binary.Api.Client.symbols(function (symbols_data)
		{
			if (needHideLoading) chartToShow.chart.hideLoading();
			needHideLoading = false;
			init_live_chart(symbols_data, globalConfig.symbol, globalConfig.chartType, globalConfig.granularity);

		},
		globalConfig.symbol,
		usedChartType,
		globalConfig.granularity);
	}

	var build_chartType_select = function ()
	{
		var usedChartType = 'ticks';
		Ext.create('Ext.form.field.ComboBox',
		{
			id: 'ext_ChartType_market',
			renderTo: 'ext_ChartType_div',
			emptyText: 'Select type',
			value: 'ticks',
			displayField: 'chartType_name',
			valueField: 'chartType_abb',
			queryMode: 'local',
			labelWidth: 70,
			padding: 5,
			editable: false,
			disabled: true,
			chartToShow: {},
			store:
			{
				fields: ['chartType_name', 'chartType_abb'],
				data:
				[
					 { chartType_name: 'Ticks', chartType_abb: 'ticks' },
					 { chartType_name: 'Candles', chartType_abb: 'candles' },
					 { chartType_name: 'Prices', chartType_abb: 'prices' },
					 { chartType_name: 'Closing price', chartType_abb: 'closing' },
					 { chartType_name: 'Median price', chartType_abb: 'median' },
					 { chartType_name: 'Weighted price', chartType_abb: 'weighted' },
					 { chartType_name: 'Typical price', chartType_abb: 'typical' }
				]
			},
			listeners:
			{
				change: function (combo)
				{
					updateChartType(combo.getValue());
				}
			}
		});
	};

	var init_live_chart = function (data, symbol, chartType, granularity) //changed
	{

		liveChartConfig = new LiveChartConfig({
			//renderTo: 'live_chart_div',
		});
		//configure_livechart();
		show_chart_for_instrument(data, symbol, chartType, granularity);
		//var barrier = new LiveChartIndicator.Barrier({ name: "spot", value: "+0" });
		//live_chart.add_indicator(barrier);
		//setInterval(function ()
		//{
		//    live_chart.remove_indicator(barrier)
		//}, 5000);  
		$("#high_barrier").change(function ()
		{
			var val = $(this).val();
			if (liveChartConfig.has_indicator('high') || !val)
			{
				//live_chart.remove_indicator('high');
			}
			if (val)
			{
				var barrier = new LiveChartIndicator.Barrier({ name: "high", value: val, color: 'green' });
				live_chart.add_indicator(barrier);
			}
		});
		$("#low_barrier").change(function ()
		{
			var val = $(this).val();
			if (liveChartConfig.has_indicator('low') || !val)
			{
				//live_chart.remove_indicator('low');
			}
			if (val)
			{
				var barrier = new LiveChartIndicator.Barrier({ name: "low", value: val, color: 'red' });
				live_chart.add_indicator(barrier);
			}
		});

		var barrier = new LiveChartIndicator.Barrier({ name: "spot", value: "+0" });
		var init = false;
		if (!init)
			$("#show_spot").on('click', function (e)
			{
				init = true;
				e.preventDefault();
				live_chart.add_indicator(barrier);
			});
	};

	var globalConfig = {};
	globalConfig.symbol = symbol_;
	globalConfig.chartType = chartType_;
	globalConfig.granularity = granularity_;
	globalConfig.resolutions = {
		'tick': { seconds: 0, interval: 3600 },
		'M1': { seconds: 60, interval: 86400 },
		'M5': { seconds: 300, interval: 7 * 86400 },
		'M30': { seconds: 1800, interval: 31 * 86400 },
		'H1': { seconds: 3600, interval: 62 * 86400 },
		'H8': { seconds: 8 * 3600, interval: 183 * 86400 },
		'D': { seconds: 86400, interval: 366 * 3 * 86400 }
	};

	$("#show_spot").hide();

	Ext.onReady(function ()
	{
		Binary.Api.Client.symbols(function (symbols_data)
		{
			init_live_chart(symbols_data, globalConfig.symbol, globalConfig.chartType, globalConfig.granularity);
			if (!Ext.getCmp('ext_ChartType_market'))
				build_chartType_select();
			//if (Ext.getCmp('ext_ChartType_market'))
			//{
			Ext.getCmp('ext_ChartType_market').enable();
			Ext.getCmp('ext_ChartType_market').chartToShow = live_chart;
			//}
		},
		globalConfig.symbol,
		globalConfig.chartType,
		'M10');
	});
}
//Charts (OHLC)
function LiveChartOHLC(params)
{
	LiveChart.call(this, params);
	this.candlestick = {};
	this.candlestick.period = this.config.resolution_seconds * 1000//() * 1000;
}

LiveChartOHLC.prototype = new LiveChart();
LiveChartOHLC.prototype.constructor = LiveChartOHLC;

LiveChartOHLC.prototype.configure_series = function (chart_params)
{
	switch (this.config.chartType)
	{
		case 'closing':
			{
				chart_params.chart.type = 'line';
				chart_params.series =
				[
					{
						name: this.config.symbol,
						data: [],
						id: 'primary_series',
						type: 'line',
					}
				];
				break;
			}
		case 'prices':
			{
				chart_params.chart.type = 'ohlc';
				chart_params.series = [{
					name: this.config.symbol,
					data: [],
					color: 'red',
					upColor: 'green',
					id: 'primary_series',
					type: 'ohlc',
				}];
				break;
			}
		case 'candles':
			{
				chart_params.chart.type = 'candlestick';
				chart_params.series = [{
					name: this.config.symbol,
					data: [],
					color: 'red',
					upColor: 'green',
					id: 'primary_series',
					type: 'candlestick',
				}];
				break;
			}
		case 'median':
			{
				chart_params.chart.type = 'line';
				chart_params.series = [{
					name: this.config.symbol,
					data: [],
					id: 'primary_series',
					type: 'line',
				}];
				break;
			}
		case 'typical':
			{
				chart_params.chart.type = 'line';
				chart_params.series = [{
					name: this.config.symbol,
					data: [],
					id: 'primary_series',
					type: 'line',
				}];
				break;
			}
		case 'weighted':
			{
				chart_params.chart.type = 'line';
				chart_params.series = [{
					name: this.config.symbol,
					data: [],
					id: 'primary_series',
					type: 'line',
				}];
				break;
			}
		default:
			{
				alert('Undefined chartType');
				break;
			}
	}
};

LiveChartOHLC.prototype.process_data = function (point)
{
	if (point.candles)
	{
		this.process_ohlc(point.candles);
	}
	else if (point.ticks)
	{
		if (this.accept_ticks && (!this.config.to || point[0] < this.config.to))
		{
			this.process_tick(point);
		}
	}
};

LiveChartOHLC.prototype.process_ohlc = function (ohlc)
{
	for (var i in ohlc)
	{
		var data_object = ohlc[i];
		var epoch = parseInt(data_object.time);

		var ohlc_pt = {
			x: epoch * 1000,
			open: parseFloat(data_object.open),
			y: parseFloat(data_object.open),
			high: parseFloat(data_object.high),
			low: parseFloat(data_object.low),
			close: parseFloat(data_object.close)
		};
		switch (this.config.chartType)
		{
			case 'closing':
				{
					ohlc_pt.y = parseFloat(data_object.close);
					break;
				}
			case 'median':
				{
					ohlc_pt.y = (parseFloat(data_object.high) + parseFloat(data_object.low)) / 2;
					break;
				}
			case 'typical':
				{
					ohlc_pt.y = (parseFloat(data_object.high) + parseFloat(data_object.low) + parseFloat(data_object.close)) / 3;
					break;
				}
			case 'weighted':
				{
					ohlc_pt.y = (parseFloat(data_object.high) + parseFloat(data_object.low) + parseFloat(data_object.close) * 2) / 4;
					break;
				}
			default:
				{
					if (this.config.chartType != 'prices' && this.config.chartType != 'candles')
						alert('Undefined chartType');
					break;
				}
		}
		this.chart.series[0].addPoint(ohlc_pt, false, false, false);
		this.spot = ohlc_pt.close;
		this.accept_ticks = true;
	}
};

LiveChartOHLC.prototype.process_tick = function (tickInput)
{
	var tick = {
		epoch: parseInt(tickInput[0]) * 1000,
		quote: parseFloat(tickInput[1]),
		squote: tickInput[1]
	};
	this.spot = tick.quote;
	if (this.chart.series)
	{
		Rollbar.error("this.chart.series is not initialized");
		return;
	}

	var data = this.chart.series[0].options.data;
	if (data.length > 0 && data[data.length - 1].x > (tick.epoch - this.candlestick.period))
	{
		var last_ohlc = data[data.length - 1];
		if (tick.quote != last_ohlc.close)
		{
			last_ohlc.close = tick.quote;
			if (last_ohlc.low > tick.quote)
				last_ohlc.low = tick.quote;
			if (last_ohlc.high < tick.quote)
				last_ohlc.high = tick.quote;

			this.chart.series[0].isDirty = true;
			this.chart.series[0].isDirtyData = true;
		}
	} else
	{
		/* add new Candlestick */
		var ohlc = {
			x: tick.epoch,
			open: tick.quote,
			y: tick.quote,
			high: tick.quote,
			low: tick.quote,
			close: tick.quote
		};
		this.chart.series[0].addPoint(ohlc, false, false, false);
	}
};

LiveChartOHLC.prototype.update_data = function (ohlc)
{
	try
	{
		if (ohlc.candles)
		{
			var data_object = ohlc.candles[ohlc.candles.length - 1];
			var epoch = parseInt(data_object.time);
			var ohlc_pt = {
				x: epoch * 1000,
				open: parseFloat(data_object.open),
				y: parseFloat(data_object.open),
				high: parseFloat(data_object.high),
				low: parseFloat(data_object.low),
				close: parseFloat(data_object.close)
			};
			switch (this.config.chartType)
			{
				case 'closing':
					{
						ohlc_pt.y = parseFloat(data_object.close);
						break;
					}
				case 'median':
					{
						ohlc_pt.y = (parseFloat(data_object.high) + parseFloat(data_object.low)) / 2;
						break;
					}
				case 'typical':
					{
						ohlc_pt.y = (parseFloat(data_object.high) + parseFloat(data_object.low) + parseFloat(data_object.close)) / 3;
						break;
					}
				case 'weighted':
					{
						ohlc_pt.y = (parseFloat(data_object.high) + parseFloat(data_object.low) + parseFloat(data_object.close) * 2) / 4;
						break;
					}
				default:
					{
						if (this.config.chartType != 'prices' && this.config.chartType != 'candles')
							alert('Undefined chartType');
						break;
					}
			};
			if (this.config.chartType == 'closing')
			{
				delete ohlc_pt.open;
				delete ohlc_pt.close;
				delete ohlc_pt.high;
				delete ohlc_pt.close;
			}
			this.chart.series[0].addPoint(ohlc_pt, true, false, false);
			this.spot = ohlc_pt.close;
			this.accept_ticks = true;
		}
	}
	catch (e) { };
};

LiveChartOHLC.prototype.get_data = function (symbol, chartType)
{
	var ChartOHLC = this;
	Binary.Api.Client.symbols(function (data)
	{
		ChartOHLC.update_data(data);
	},
	Binary.Api.Intervals.Fast,
	symbol,
	'candles');
}
//Charts (tick)
function LiveChartTick(params)
{
	LiveChart.call(this, params);
}

LiveChartTick.prototype = new LiveChart();

LiveChartTick.prototype.constructor = LiveChartTick;
LiveChartTick.prototype.configure_series = function (chart_params)
{
	chart_params.chart.type = 'line';
	if (this.config.with_tick_config)
	{
		chart_params.xAxis.labels = { enabled: false };
	} else
	{
		chart_params.xAxis.labels = { format: "{value:%H:%M:%S}" };
	}
	chart_params.series = [
	{
		name: this.config.symbol,// TODO: add real symbol name as translated_display_name()
		data: [],
		id: 'primary_series',
		dataGrouping:
		{
			enabled: false
		},
		tooltip:
		{
			xDateFormat: "%A, %b %e, %H:%M:%S GMT"
		},
		type: 'line'
	}];
};

LiveChartTick.prototype.process_data = function (point)
{
	if (point.ticks)
	{
		for (var i in point.ticks)
		{
			var data_object = point.ticks[i];
			var tick =
			{
				epoch: parseInt(data_object.time),
				quote: parseFloat(data_object.price)
			};
			this.chart.series[0].addPoint(
                [tick.epoch * 1000, tick.quote], false, this.shift, false
            );
			this.spot = tick.quote;
			var tradePanel = Ext.ComponentQuery.query('[name=tradePanel_container]')[0];
			if (tradePanel)
			{
				var spot_fields = tradePanel.query('[name=spot]');
				if (spot_fields.length > 0)
					for (var sp in spot_fields)
						spot_fields[sp].setValue(this.spot);
			}
		}
	}
};
LiveChartTick.prototype.update_data = function (point)
{
	try
	{
		if (point.ticks)
		{
			var tick =
			{
				epoch: parseInt(point.ticks[point.ticks.length - 1].time),
				quote: parseFloat(point.ticks[point.ticks.length - 1].price)
			};
			//if (!this.config.to || tick.epoch <= this.config.to)
			//{
			this.chart.series[0].addPoint(
                [tick.epoch * 1000, tick.quote], true, this.shift, false
            );

			this.config.repaint_indicators(this);//temp
			this.chart.redraw();

			var spot_fields = Ext.ComponentQuery.query('[name=tradePanel_container]')[0].query('[name=spot]');
			for (var sp in spot_fields)
			{
				var spot_field = spot_fields[sp];

				spot_field.setValue(this.spot);

				if (this.spot > tick.quote)
				{
					spot_field.inputEl.addCls('red_field');
					spot_field.inputEl.removeCls('blue_field');
				}
				else
				{
					spot_field.inputEl.addCls('blue_field');
					spot_field.inputEl.removeCls('red_field');
				}

				this.spot = tick.quote;
				spot_field.setValue(this.spot);
			}
		}
	}
	catch (e) { };
};
LiveChartTick.prototype.get_data = function (symbol, chartType, granularity)
{
	var me = this;
	var res = this.config.resolutions[granularity].interval;
	Binary.Api.Client.symbols(function (data)
	{
		me.update_data(data);
	},
	Binary.Api.Intervals.Fast,
	symbol,
	'ticks',
	Math.round(+new Date() / 1000) - res,
	Math.round(+new Date() / 1000),
	20000);
}

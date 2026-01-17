# set a default version
ARG VERSION=12.3.1

FROM grafana/grafana-oss:${VERSION}

# SETUP DATASOURCES

COPY datasources /etc/grafana/provisioning/datasources

# SETUP DASHBOARDS

# first copy the config for the dashboards 
COPY dashboards/dashboards.yaml /etc/grafana/provisioning/dashboards/dashboards.yaml
# then copy the dashboard templates
COPY dashboards/templates /etc/grafana/dashboards
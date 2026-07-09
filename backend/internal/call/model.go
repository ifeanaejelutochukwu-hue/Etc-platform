package call

type RoomConfig struct {
	Name        string
	EmptyTimeout int
	MaxParticipants int
}

type TokenOptions struct {
	Identity string
	RoomName string
	IsPublisher bool
	Name    string
}
